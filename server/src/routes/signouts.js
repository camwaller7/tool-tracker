import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireNotLocked, requireSupervisor } from '../middleware.js';
import { newId, now } from '../util.js';
import { notify } from '../notify.js';

const router = Router();

// POST /api/signouts  — the morning sign-out (PRD §4.4).
// Body: { jobId, supervisorId, items: [{ toolId, photoRef }] }
// One signout row per tool. Photo per tool is mandatory. Atomic: if any tool
// is unavailable the whole sign-out is rejected (nothing half-committed).
router.post('/', requireAuth, requireNotLocked, (req, res) => {
  const { jobId, supervisorId, items } = req.body || {};
  if (!jobId || !supervisorId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'jobId, supervisorId and at least one tool required' });
  }

  const job = db.prepare("SELECT * FROM job WHERE id = ? AND status = 'active'").get(jobId);
  if (!job) return res.status(400).json({ error: 'Job not found or not active' });

  // Supervisor must be one assigned to this job (PRD §4.4 step 3).
  const assigned = db
    .prepare('SELECT 1 FROM job_supervisor WHERE jobId = ? AND supervisorId = ?')
    .get(jobId, supervisorId);
  if (!assigned) return res.status(400).json({ error: 'Supervisor not assigned to this job' });

  // Validate every item up front.
  for (const it of items) {
    if (!it || !it.toolId) return res.status(400).json({ error: 'Each item needs a toolId' });
    if (!it.photoRef) {
      return res.status(400).json({ error: 'A photo is required for every tool' });
    }
    const tool = db.prepare('SELECT * FROM tool WHERE id = ?').get(it.toolId);
    if (!tool) return res.status(400).json({ error: `Tool not found: ${it.toolId}` });
    if (tool.status !== 'available') {
      return res.status(409).json({ error: `${tool.name} is no longer available` });
    }
  }

  const at = now();
  const created = [];
  const tx = db.transaction(() => {
    for (const it of items) {
      const id = newId('signout');
      db.prepare(
        `INSERT INTO signout
          (id, toolId, userId, currentResponsible, jobId, supervisorId, signOutAt, signOutPhoto, supervisorSignoff, transferred)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'n/a', '[]')`
      ).run(id, it.toolId, req.user.id, req.user.id, jobId, supervisorId, at, it.photoRef);

      db.prepare(
        `UPDATE tool SET status = 'out', currentHolder = ?, currentJob = ?, currentSignoutId = ?
         WHERE id = ?`
      ).run(req.user.id, jobId, id, it.toolId);
      created.push(id);
    }
  });
  tx();

  res.status(201).json({ count: created.length, signoutIds: created });
});

// GET /api/signouts/mine — everything currently signed out to me (PRD §4.8
// step 1), including anything transferred to me (currentResponsible).
router.get('/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, t.name AS toolName, t.category AS toolCategory,
              j.name AS jobName, sup.name AS supervisorName
       FROM signout s
       JOIN tool t ON t.id = s.toolId
       JOIN job j ON j.id = s.jobId
       JOIN person sup ON sup.id = s.supervisorId
       WHERE s.currentResponsible = ? AND s.returnAt IS NULL
       ORDER BY s.signOutAt DESC`
    )
    .all(req.user.id);

  res.json({
    items: rows.map((s) => ({
      signoutId: s.id,
      toolId: s.toolId,
      toolName: s.toolName,
      toolCategory: s.toolCategory,
      jobName: s.jobName,
      supervisorName: s.supervisorName,
      signOutAt: s.signOutAt,
      signOutPhoto: s.signOutPhoto,
    })),
  });
});

const ISSUE_LABELS = {
  damaged: 'Damaged / needs repair',
  missingPart: 'Missing a part/attachment',
  consumable: 'Battery/consumable needs replacing',
  other: 'Other issue',
};

// POST /api/signouts/:id/return — end-of-day return (PRD §4.8).
// Body: { returnPhoto, condition: 'fine'|'issue', issues: [key], note }
// Photo + condition both mandatory. A damaged/issue return auto-flags the
// tool unavailable (ROADMAP Phase 1 — no admin step).
router.post('/:id/return', requireAuth, async (req, res) => {
  const { returnPhoto, condition, issues, note } = req.body || {};
  const so = db.prepare('SELECT * FROM signout WHERE id = ?').get(req.params.id);
  if (!so) return res.status(404).json({ error: 'Sign-out not found' });
  if (so.returnAt) return res.status(409).json({ error: 'Already returned' });
  if (so.currentResponsible !== req.user.id) {
    return res.status(403).json({ error: 'This tool is not signed out to you' });
  }
  if (!returnPhoto) return res.status(400).json({ error: 'A return photo is required' });
  if (condition !== 'fine' && condition !== 'issue') {
    return res.status(400).json({ error: 'Choose a condition (fine or issue)' });
  }

  // Build notes from ticked checkboxes + optional free text.
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
  const tx = db.transaction(() => {
    // Signoff state: pending only while the returner is in a supervised period.
    const signoff = condition === 'fine' && supervised ? 'pending' : 'n/a';
    db.prepare(
      `UPDATE signout SET returnAt = ?, returnPhoto = ?, condition = ?, notes = ?, supervisorSignoff = ?
       WHERE id = ?`
    ).run(at, returnPhoto, condition, notes, signoff, so.id);

    if (condition === 'issue') {
      // Auto-flag unavailable; stays out of tomorrow's list until a supervisor
      // resolves it. currentSignoutId keeps pointing at this record.
      db.prepare(
        `UPDATE tool SET status = 'damaged', currentHolder = NULL, currentJob = NULL
         WHERE id = ?`
      ).run(so.toolId);
    } else if (supervised) {
      // Physically back, but not available until supervisor confirms (Phase 3).
      db.prepare(
        `UPDATE tool SET status = 'pending-signoff', currentHolder = NULL, currentJob = NULL
         WHERE id = ?`
      ).run(so.toolId);
    } else {
      // Clean return → straight back on the shelf.
      db.prepare(
        `UPDATE tool SET status = 'available', currentHolder = NULL, currentJob = NULL, currentSignoutId = NULL
         WHERE id = ?`
      ).run(so.toolId);
    }
  });
  tx();

  // Damage auto-flag also texts the responsible supervisor immediately
  // (PRD §4.8 / §6). Fire-and-forget: a failed SMS never fails the return.
  if (condition === 'issue') {
    const tool = db.prepare('SELECT name FROM tool WHERE id = ?').get(so.toolId);
    await notify({
      type: 'damage',
      channel: 'sms',
      recipientId: so.supervisorId,
      message: `Tool Tracker: ${tool.name} returned with an issue by ${req.user.name}` +
        `${notes ? ` — ${notes}` : ''}. It's been pulled from tomorrow's list until you resolve it.`,
    });
  }

  const tool = db.prepare('SELECT status FROM tool WHERE id = ?').get(so.toolId);
  res.json({ ok: true, toolStatus: tool.status });
});

// POST /api/signouts/:id/transfer  { toUserId }  — supervisor manual transfer
// (PRD §4.6). Only supervisors/admins. Moves the return obligation to another
// person; the original signer (userId) and sign-out photo/history stay intact.
// Appended to the signout's `transferred` log and mirrored to tool.currentHolder.
router.post('/:id/transfer', requireAuth, requireSupervisor, (req, res) => {
  const { toUserId } = req.body || {};
  if (!toUserId) return res.status(400).json({ error: 'toUserId required' });

  const so = db.prepare('SELECT * FROM signout WHERE id = ?').get(req.params.id);
  if (!so) return res.status(404).json({ error: 'Sign-out not found' });
  if (so.returnAt) return res.status(409).json({ error: 'Tool already returned — nothing to transfer' });

  const toPerson = db.prepare('SELECT * FROM person WHERE id = ?').get(toUserId);
  if (!toPerson) return res.status(400).json({ error: 'Unknown person' });
  if (toPerson.status === 'locked') return res.status(400).json({ error: 'That account is locked' });
  if (toUserId === so.currentResponsible) {
    return res.status(400).json({ error: 'Already responsible for this tool' });
  }

  const at = now();
  const log = JSON.parse(so.transferred || '[]');
  log.push({ from: so.currentResponsible, to: toUserId, by: req.user.id, at });

  const tx = db.transaction(() => {
    db.prepare('UPDATE signout SET currentResponsible = ?, transferred = ? WHERE id = ?')
      .run(toUserId, JSON.stringify(log), so.id);
    // Tool stays out; the holder changes.
    db.prepare('UPDATE tool SET currentHolder = ? WHERE id = ?').run(toUserId, so.toolId);
  });
  tx();

  res.json({ ok: true, currentResponsible: { id: toPerson.id, name: toPerson.name } });
});

export default router;
