import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';
import { newId, now, hashPin, publicPerson } from '../util.js';

const router = Router();

// List people. Any authenticated user can read the roster (needed to pick a
// supervisor at sign-out, show holders, etc.); writes are admin-only.
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM person ORDER BY name').all();
  res.json({ people: rows.map(publicPerson) });
});

// Just the supervisors (for admin job assignment UI).
router.get('/supervisors', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM person WHERE isSupervisor = 1 ORDER BY name')
    .all();
  res.json({ people: rows.map(publicPerson) });
});

// Admin: register a person. name + at least one of phone/email + PIN.
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { name, phone, email, pin, roles } = req.body || {};
  if (!name || !pin) return res.status(400).json({ error: 'name and pin required' });
  if (!phone && !email) {
    return res.status(400).json({ error: 'phone or email required (used for login)' });
  }
  const r = roles || {};
  const id = newId('person');
  try {
    db.prepare(
      `INSERT INTO person (id, name, phone, email, pinHash, isEmployee, isSupervisor, isAdmin, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).run(
      id,
      name.trim(),
      phone?.trim() || null,
      email?.trim().toLowerCase() || null,
      hashPin(pin),
      r.employee === false ? 0 : 1, // default: everyone can sign tools out
      r.supervisor ? 1 : 0,
      r.admin ? 1 : 0,
      now()
    );
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Phone or email already in use' });
    }
    throw e;
  }
  const person = db.prepare('SELECT * FROM person WHERE id = ?').get(id);
  res.status(201).json({ person: publicPerson(person) });
});

export default router;
