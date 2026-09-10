import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now } from '../util.js';

const router = Router();

// Shape a tool with live status: who has it, which job, since when.
function shapeTool(t) {
  let holder = null;
  let job = null;
  let since = null;
  if (t.currentSignoutId) {
    const so = db.prepare('SELECT * FROM signout WHERE id = ?').get(t.currentSignoutId);
    if (so) {
      const h = db.prepare('SELECT id, name FROM person WHERE id = ?').get(so.currentResponsible);
      const j = db.prepare('SELECT id, name, client FROM job WHERE id = ?').get(so.jobId);
      holder = h || null;
      job = j || null;
      since = so.signOutAt;
    }
  }
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    assetTag: t.assetTag,
    status: t.status,
    retiredReason: t.retiredReason,
    photoRef: t.photoRef,
    holder,
    job,
    since,
  };
}

// List / search tools. ?q= text search, ?status=available|out|...,
// ?available=1 shorthand for the sign-out picker.
router.get('/', requireAuth, (req, res) => {
  const clauses = [];
  const params = [];
  if (req.query.available) {
    clauses.push("status = 'available'");
  } else if (req.query.status) {
    clauses.push('status = ?');
    params.push(String(req.query.status));
  }
  if (req.query.q) {
    clauses.push('(name LIKE ? OR category LIKE ? OR assetTag LIKE ?)');
    const like = `%${req.query.q}%`;
    params.push(like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM tool ${where} ORDER BY category, name`).all(...params);
  res.json({ tools: rows.map(shapeTool) });
});

// Single tool + full chronological history (PRD §4.7). History is just every
// signout row for the tool, oldest first — no separate history table.
router.get('/:id', requireAuth, (req, res) => {
  const tool = db.prepare('SELECT * FROM tool WHERE id = ?').get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  const rows = db
    .prepare('SELECT * FROM signout WHERE toolId = ? ORDER BY signOutAt ASC')
    .all(tool.id);
  const nameOf = (id) => db.prepare('SELECT name FROM person WHERE id = ?').get(id)?.name || null;
  const history = rows.map((s) => ({
    id: s.id,
    signer: { id: s.userId, name: nameOf(s.userId) },
    currentResponsible: { id: s.currentResponsible, name: nameOf(s.currentResponsible) },
    supervisor: { id: s.supervisorId, name: nameOf(s.supervisorId) },
    job: db.prepare('SELECT id, name, client FROM job WHERE id = ?').get(s.jobId) || null,
    signOutAt: s.signOutAt,
    signOutPhoto: s.signOutPhoto,
    returnAt: s.returnAt,
    returnPhoto: s.returnPhoto,
    condition: s.condition,
    notes: s.notes,
    supervisorSignoff: s.supervisorSignoff,
    transferred: JSON.parse(s.transferred || '[]'),
  }));

  res.json({ tool: shapeTool(tool), history });
});

// Admin: register a tool. Appears immediately as "available".
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { name, category, assetTag, photoRef } = req.body || {};
  if (!name || !category) return res.status(400).json({ error: 'name and category required' });
  const id = newId('tool');
  db.prepare(
    `INSERT INTO tool (id, name, category, assetTag, status, photoRef, createdAt)
     VALUES (?, ?, ?, ?, 'available', ?, ?)`
  ).run(id, name.trim(), category.trim(), assetTag?.trim() || null, photoRef || null, now());
  res.status(201).json({ tool: shapeTool(db.prepare('SELECT * FROM tool WHERE id = ?').get(id)) });
});

export default router;
