import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireNotLocked, requireSupervisor } from '../middleware.js';
import { newId, now } from '../util.js';
import { notify } from '../notify.js';

const router = Router();

// POST /api/signouts — the morning sign-out (PRD §4.4).
// Body: { jobId, supervisorId, items: [{ toolId, photoRef }] }
router.post('/', requireAuth, requireNotLocked, async (req, res, next) => {
  try {
    const { jobId, supervisorId, items } = req.body || {};
    if (!jobId || !supervisorId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'jobId, supervisorId and at least one tool required' });
    }

    const job = await q.one("SELECT * FROM job WHERE \"id\" = $1 AND \"status\" = 'active'", [jobId]);
    if (!job) return res.status(400).json({ error: 'Job not found or not active' });

    const assigned = await q.one(
      'SELECT 1 FROM job_supervisor WHERE "jobId" = $1 AND "supervisorId" = $2',
      [jobId, supervisorId]
    );
    if (!assigned) return res.status(400).json({ error: 'Supervisor not assigned to this job' });

    for (const it of items) {
      if (!it || !it.toolId) return res.status(400).json({ error: 'Each item needs a toolId' });
      if (!it.photoRef) return res.status(400).json({ error: 'A photo is required for every tool' });
      const tool = await q.one('SELECT * FROM tool WHERE "id" = $1', [it.toolId]);
      if (!tool) return res.status(400).json({ error: `Tool not found: ${it.toolId}` });
      if (tool.status !== 'available') {
        return res.status(409).json({ error: `${tool.name} is no longer available` });
      }
    }

    const at = now();
    const created = [];
    await q.tx(async (t) => {
      for (const it of items) {
        const id = newId('signout');
        await t.run(
          `INSERT INTO signout
            ("id","toolId","userId","currentResponsible","jobId","supervisorId","signOutAt","signOutPhoto","supervisorSignoff","transferred")
           VALUES ($1,$2,$3,$3,$4,$5,$6,$7,'n/a','[]'::jsonb)`,
          [id, it.toolId, req.user.id, jobId, supervisorId, at, it.photoRef]
        );
        await t.run(
          `UPDATE tool SET "status"='out', "currentHolder"=$1, "currentJob"=$2, "currentSignoutId"=$3 WHERE "id"=$4`,
          [req.user.id, jobId, id, it.toolId]
        );
        created.push(id);
      }
    });
    res.status(201).json({ count: created.length, signoutIds: created });
  } catch (e) { next(e); }
});

// GET /api/signouts/mine — everything currently signed out to me (PRD §4.8).
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const rows = await q.all(
      `SELECT s.*, t."name" AS "toolName", t."category" AS "toolCategory",
              j."name" AS "jobName", sup."name" AS "supervisorName"
       FROM signout s
       JOIN tool t ON t."id" = s."toolId"
       JOIN job j ON j."id" = s."jobId"
       JOIN person sup ON sup."id" = s."supervisorId"
       WHERE s."currentResponsible" = $1 AND s."returnAt" IS NULL
       ORDER BY s."signOutAt" DESC`,
      [req.user.id]
    );
    res.json({
      items: rows.map((s) => ({
        signoutId: s.id, toolId: s.toolId, toolName: s.toolName, toolCategory: s.toolCategory,
        jobName: s.jobName, supervisorName: s.supervisorName,
        signOutAt: s.signOutAt, signOutPhoto: s.signOutPhoto,
      })),
    });
  } catch (e) { next(e); }
});

const ISSUE_LABELS = {
  damaged: 'Damaged / needs repair',
  missingPart: 'Missing a part/attachment',
  consumable: 'Battery/consumable needs replacing',
  other: 'Other issue',
};

// POST /api/signouts/:id/return — end-of-day return (PRD §4.8).
router.post('/:id/return', requireAuth, async (req, res, next) => {
  try {
    const { returnPhoto, condition, issues, note } = req.body || {};
    const so = await q.one('SELECT * FROM signout WHERE "id" = $1', [req.params.id]);
    if (!so) return res.status(404).json({ error: 'Sign-out not found' });
    if (so.returnAt) return res.status(409).json({ error: 'Already returned' });
    if (so.currentResponsible !== req.user.id) {
      return res.status(403).json({ error: 'This tool is not signed out to you' });
    }
    if (!returnPhoto) return res.status(400).json({ error: 'A return photo is required' });
    if (condition !== 'fine' && condition !== 'issue') {
      return res.status(400).json({ error: 'Choose a condition (fine or issue)' });
    }

    let notes = null;
    if (condition === 'issue') {
      const ticked = Array.isArray(issues) ? issues.filter((k) => ISSUE_LABELS[k]) : [];
      const parts = ticked.map((k) => ISSUE_LABELS[k]);
      if (note && String(note).trim()) parts.push(`Note: ${String(note).trim()}`);
      notes = parts.join('; ') || 'Issue reported';
    } else if (note && String(note).trim()) {
      notes = `Note: ${String(note).trim()}`;
    }

    const at = now();
    const supervised = req.user.status === 'supervised';
    await q.tx(async (t) => {
      const signoff = condition === 'fine' && supervised ? 'pending' : 'n/a';
      await t.run(
        `UPDATE signout SET "returnAt"=$1, "returnPhoto"=$2, "condition"=$3, "notes"=$4, "supervisorSignoff"=$5 WHERE "id"=$6`,
        [at, returnPhoto, condition, notes, signoff, so.id]
      );
      if (condition === 'issue') {
        await t.run(`UPDATE tool SET "status"='damaged', "currentHolder"=NULL, "currentJob"=NULL WHERE "id"=$1`, [so.toolId]);
      } else if (supervised) {
        await t.run(`UPDATE tool SET "status"='pending-signoff', "currentHolder"=NULL, "currentJob"=NULL WHERE "id"=$1`, [so.toolId]);
      } else {
        await t.run(`UPDATE tool SET "status"='available', "currentHolder"=NULL, "currentJob"=NULL, "currentSignoutId"=NULL WHERE "id"=$1`, [so.toolId]);
      }
    });

    // Damage auto-flag also texts the responsible supervisor (PRD §4.8 / §6).
    if (condition === 'issue') {
      const tool = await q.one('SELECT "name" FROM tool WHERE "id" = $1', [so.toolId]);
      await notify({
        type: 'damage', channel: 'sms', recipientId: so.supervisorId,
        message: `Tool Tracker: ${tool.name} returned with an issue by ${req.user.name}` +
          `${notes ? ` — ${notes}` : ''}. It's been pulled from tomorrow's list until you resolve it.`,
      });
    }

    const tool = await q.one('SELECT "status" FROM tool WHERE "id" = $1', [so.toolId]);
    res.json({ ok: true, toolStatus: tool.status });
  } catch (e) { next(e); }
});

// POST /api/signouts/:id/transfer  { toUserId } — supervisor manual transfer (PRD §4.6).
router.post('/:id/transfer', requireAuth, requireSupervisor, async (req, res, next) => {
  try {
    const { toUserId } = req.body || {};
    if (!toUserId) return res.status(400).json({ error: 'toUserId required' });

    const so = await q.one('SELECT * FROM signout WHERE "id" = $1', [req.params.id]);
    if (!so) return res.status(404).json({ error: 'Sign-out not found' });
    if (so.returnAt) return res.status(409).json({ error: 'Tool already returned — nothing to transfer' });

    const toPerson = await q.one('SELECT * FROM person WHERE "id" = $1', [toUserId]);
    if (!toPerson) return res.status(400).json({ error: 'Unknown person' });
    if (toPerson.status === 'locked') return res.status(400).json({ error: 'That account is locked' });
    if (toUserId === so.currentResponsible) {
      return res.status(400).json({ error: 'Already responsible for this tool' });
    }

    const at = now();
    const log = [...(so.transferred || []), { from: so.currentResponsible, to: toUserId, by: req.user.id, at }];
    await q.tx(async (t) => {
      await t.run('UPDATE signout SET "currentResponsible"=$1, "transferred"=$2::jsonb WHERE "id"=$3',
        [toUserId, JSON.stringify(log), so.id]);
      await t.run('UPDATE tool SET "currentHolder"=$1 WHERE "id"=$2', [toUserId, so.toolId]);
    });
    res.json({ ok: true, currentResponsible: { id: toPerson.id, name: toPerson.name } });
  } catch (e) { next(e); }
});

export default router;
