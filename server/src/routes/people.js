import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now, hashPin, publicPerson } from '../util.js';

const router = Router();

// List people. Any authenticated user can read the roster; writes are admin-only.
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const rows = await q.all('SELECT * FROM person ORDER BY "name"');
    res.json({ people: rows.map(publicPerson) });
  } catch (e) { next(e); }
});

// Just the supervisors (for admin job assignment UI).
router.get('/supervisors', requireAuth, async (_req, res, next) => {
  try {
    const rows = await q.all('SELECT * FROM person WHERE "isSupervisor" = TRUE ORDER BY "name"');
    res.json({ people: rows.map(publicPerson) });
  } catch (e) { next(e); }
});

// Admin: register a person. name + at least one of phone/email + PIN.
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, phone, email, pin, roles } = req.body || {};
    if (!name || !pin) return res.status(400).json({ error: 'name and pin required' });
    if (!phone && !email) {
      return res.status(400).json({ error: 'phone or email required (used for login)' });
    }
    const r = roles || {};
    const id = newId('person');
    try {
      await q.run(
        `INSERT INTO person ("id","name","phone","email","pinHash","isEmployee","isSupervisor","isAdmin","status","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9)`,
        [
          id,
          name.trim(),
          phone?.trim() || null,
          email?.trim().toLowerCase() || null,
          hashPin(pin),
          r.employee === false ? false : true,
          !!r.supervisor,
          !!r.admin,
          now(),
        ]
      );
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Phone or email already in use' });
      throw e;
    }
    const person = await q.one('SELECT * FROM person WHERE "id" = $1', [id]);
    res.status(201).json({ person: publicPerson(person) });
  } catch (e) { next(e); }
});

export default router;
