import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now } from '../util.js';

const router = Router();

// Shape a tool with live status: who has it, which job, since when.
async function shapeTool(t) {
  let holder = null;
  let job = null;
  let since = null;
  if (t.currentSignoutId) {
    const so = await q.one('SELECT * FROM signout WHERE "id" = $1', [t.currentSignoutId]);
    if (so) {
      holder = await q.one('SELECT "id","name" FROM person WHERE "id" = $1', [so.currentResponsible]) || null;
      job = await q.one('SELECT "id","name","client" FROM job WHERE "id" = $1', [so.jobId]) || null;
      since = so.signOutAt;
    }
  }
  return {
    id: t.id, name: t.name, category: t.category, assetTag: t.assetTag,
    status: t.status, retiredReason: t.retiredReason, photoRef: t.photoRef,
    holder, job, since,
  };
}

// List / search tools. ?q= text search, ?status=…, ?available=1 shorthand.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const clauses = [];
    const params = [];
    if (req.query.available) {
      clauses.push("\"status\" = 'available'");
    } else if (req.query.status) {
      params.push(String(req.query.status));
      clauses.push(`"status" = $${params.length}`);
    }
    if (req.query.q) {
      const like = `%${req.query.q}%`;
      params.push(like);
      clauses.push(`("name" ILIKE $${params.length} OR "category" ILIKE $${params.length} OR "assetTag" ILIKE $${params.length})`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await q.all(`SELECT * FROM tool ${where} ORDER BY "category", "name"`, params);
    res.json({ tools: await Promise.all(rows.map(shapeTool)) });
  } catch (e) { next(e); }
});

// Single tool + full chronological history (PRD §4.7).
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const tool = await q.one('SELECT * FROM tool WHERE "id" = $1', [req.params.id]);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });

    const rows = await q.all('SELECT * FROM signout WHERE "toolId" = $1 ORDER BY "signOutAt" ASC', [tool.id]);
    const nameOf = async (id) => (await q.one('SELECT "name" FROM person WHERE "id" = $1', [id]))?.name || null;
    const history = [];
    for (const s of rows) {
      history.push({
        id: s.id,
        signer: { id: s.userId, name: await nameOf(s.userId) },
        currentResponsible: { id: s.currentResponsible, name: await nameOf(s.currentResponsible) },
        supervisor: { id: s.supervisorId, name: await nameOf(s.supervisorId) },
        job: await q.one('SELECT "id","name","client" FROM job WHERE "id" = $1', [s.jobId]) || null,
        signOutAt: s.signOutAt,
        signOutPhoto: s.signOutPhoto,
        returnAt: s.returnAt,
        returnPhoto: s.returnPhoto,
        condition: s.condition,
        notes: s.notes,
        supervisorSignoff: s.supervisorSignoff,
        transferred: s.transferred || [],
      });
    }
    res.json({ tool: await shapeTool(tool), history });
  } catch (e) { next(e); }
});

// Admin: register a tool. Appears immediately as "available".
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, category, assetTag, photoRef } = req.body || {};
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });
    const id = newId('tool');
    await q.run(
      `INSERT INTO tool ("id","name","category","assetTag","status","photoRef","createdAt")
       VALUES ($1,$2,$3,$4,'available',$5,$6)`,
      [id, name.trim(), category.trim(), assetTag?.trim() || null, photoRef || null, now()]
    );
    res.status(201).json({ tool: await shapeTool(await q.one('SELECT * FROM tool WHERE "id" = $1', [id])) });
  } catch (e) { next(e); }
});

export default router;
