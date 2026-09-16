import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now } from '../util.js';

const router = Router();

async function supervisorsForJob(jobId) {
  return q.all(
    `SELECT p."id", p."name" FROM job_supervisor js
     JOIN person p ON p."id" = js."supervisorId"
     WHERE js."jobId" = $1 ORDER BY p."name"`,
    [jobId]
  );
}

async function shapeJob(job) {
  return { ...job, supervisors: await supervisorsForJob(job.id) };
}

// List jobs. ?active=1 → only active jobs (the sign-out job picker).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = req.query.active
      ? await q.all("SELECT * FROM job WHERE \"status\" = 'active' ORDER BY \"name\"")
      : await q.all('SELECT * FROM job ORDER BY "status", "name"');
    res.json({ jobs: await Promise.all(rows.map(shapeJob)) });
  } catch (e) { next(e); }
});

// Admin: register a job with one or more assigned supervisors.
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, client, supervisorIds } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const ids = Array.isArray(supervisorIds) ? supervisorIds : [];
    if (ids.length === 0) return res.status(400).json({ error: 'assign at least one supervisor' });

    for (const sid of ids) {
      const p = await q.one('SELECT "isSupervisor","isAdmin" FROM person WHERE "id" = $1', [sid]);
      if (!p || (!p.isSupervisor && !p.isAdmin)) {
        return res.status(400).json({ error: `Not a supervisor: ${sid}` });
      }
    }
    const id = newId('job');
    await q.tx(async (t) => {
      await t.run('INSERT INTO job ("id","name","client","status","createdAt") VALUES ($1,$2,$3,$4,$5)',
        [id, name.trim(), client?.trim() || null, 'active', now()]);
      for (const sid of ids) {
        await t.run('INSERT INTO job_supervisor ("jobId","supervisorId") VALUES ($1,$2)', [id, sid]);
      }
    });
    res.status(201).json({ job: await shapeJob(await q.one('SELECT * FROM job WHERE "id" = $1', [id])) });
  } catch (e) { next(e); }
});

// Admin: close a job (stops it appearing in the sign-out picker).
router.post('/:id/close', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const job = await q.one('SELECT * FROM job WHERE "id" = $1', [req.params.id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    await q.run("UPDATE job SET \"status\" = 'closed' WHERE \"id\" = $1", [job.id]);
    res.json({ job: await shapeJob(await q.one('SELECT * FROM job WHERE "id" = $1', [job.id])) });
  } catch (e) { next(e); }
});

export default router;
