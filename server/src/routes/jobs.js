import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now } from '../util.js';

const router = Router();

function supervisorsForJob(jobId) {
  return db
    .prepare(
      `SELECT p.id, p.name FROM job_supervisor js
       JOIN person p ON p.id = js.supervisorId
       WHERE js.jobId = ? ORDER BY p.name`
    )
    .all(jobId);
}

function shapeJob(job) {
  return { ...job, supervisors: supervisorsForJob(job.id) };
}

// List jobs. ?active=1 → only active jobs (the sign-out job picker).
router.get('/', requireAuth, (req, res) => {
  const rows = req.query.active
    ? db.prepare("SELECT * FROM job WHERE status = 'active' ORDER BY name").all()
    : db.prepare('SELECT * FROM job ORDER BY status, name').all();
  res.json({ jobs: rows.map(shapeJob) });
});

// Admin: register a job with one or more assigned supervisors.
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { name, client, supervisorIds } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const ids = Array.isArray(supervisorIds) ? supervisorIds : [];
  if (ids.length === 0) {
    return res.status(400).json({ error: 'assign at least one supervisor' });
  }
  // Validate each is a real supervisor.
  for (const sid of ids) {
    const p = db.prepare('SELECT isSupervisor, isAdmin FROM person WHERE id = ?').get(sid);
    if (!p || (!p.isSupervisor && !p.isAdmin)) {
      return res.status(400).json({ error: `Not a supervisor: ${sid}` });
    }
  }
  const id = newId('job');
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO job (id, name, client, status, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(id, name.trim(), client?.trim() || null, 'active', now());
    const ins = db.prepare('INSERT INTO job_supervisor (jobId, supervisorId) VALUES (?, ?)');
    for (const sid of ids) ins.run(id, sid);
  });
  tx();
  res.status(201).json({ job: shapeJob(db.prepare('SELECT * FROM job WHERE id = ?').get(id)) });
});

// Admin: close a job (stops it appearing in the sign-out picker).
router.post('/:id/close', requireAuth, requireAdmin, (req, res) => {
  const job = db.prepare('SELECT * FROM job WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  db.prepare("UPDATE job SET status = 'closed' WHERE id = ?").run(job.id);
  res.json({ job: shapeJob(db.prepare('SELECT * FROM job WHERE id = ?').get(job.id)) });
});

export default router;
