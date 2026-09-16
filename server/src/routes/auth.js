import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth } from '../middleware.js';
import { verifyPin, signToken, publicPerson } from '../util.js';

const router = Router();

// POST /api/auth/login  { identifier, pin }
// identifier is a phone or email. Phase 1 auth = phone/email + PIN.
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, pin } = req.body || {};
    if (!identifier || !pin) {
      return res.status(400).json({ error: 'identifier and pin required' });
    }
    const id = String(identifier).trim().toLowerCase();
    const person = await q.one(
      'SELECT * FROM person WHERE lower("phone") = $1 OR lower("email") = $1',
      [id]
    );
    if (!person || !verifyPin(pin, person.pinHash)) {
      return res.status(401).json({ error: 'Invalid login or PIN' });
    }
    res.json({ token: signToken(person), user: publicPerson(person) });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me — resolve the current token to a user.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicPerson(req.user) });
});

export default router;
