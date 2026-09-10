import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware.js';
import { verifyPin, signToken, publicPerson } from '../util.js';

const router = Router();

// POST /api/auth/login  { identifier, pin }
// identifier is a phone or email. Phase 1 auth = phone/email + PIN (swappable;
// see README). Verified login is what makes a sign-out record trustworthy.
router.post('/login', (req, res) => {
  const { identifier, pin } = req.body || {};
  if (!identifier || !pin) {
    return res.status(400).json({ error: 'identifier and pin required' });
  }
  const id = String(identifier).trim().toLowerCase();
  const person = db
    .prepare('SELECT * FROM person WHERE lower(phone) = ? OR lower(email) = ?')
    .get(id, id);

  // Same generic error whether the user is missing or the PIN is wrong.
  if (!person || !verifyPin(pin, person.pinHash)) {
    return res.status(401).json({ error: 'Invalid login or PIN' });
  }
  res.json({ token: signToken(person), user: publicPerson(person) });
});

// GET /api/auth/me — resolve the current token to a user.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicPerson(req.user) });
});

export default router;
