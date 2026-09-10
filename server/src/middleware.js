import db from './db.js';
import { verifyToken } from './util.js';

// Attaches req.user (the person row) from the Bearer token. Rejects if missing
// or invalid. This is the server-side backbone of accountability (PRD §7):
// every write is tied to a verified user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });

  const user = db.prepare('SELECT * FROM person WHERE id = ?').get(payload.sub);
  if (!user) return res.status(401).json({ error: 'Unknown user' });

  req.user = user;
  next();
}

// Role guards. These are enforced here, server-side — never trust the UI to
// hide a button (ROADMAP cross-cutting rule).
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin only' });
  next();
}

// Supervisor OR admin. Per CLAUDE.md only supervisors (or admins) may transfer,
// confirm repaired, or confirm lost/stolen/broken. Those are Phase 2/3 routes,
// but the guard lives here now.
export function requireSupervisor(req, res, next) {
  if (!req.user?.isSupervisor && !req.user?.isAdmin) {
    return res.status(403).json({ error: 'Supervisor only' });
  }
  next();
}

// An employee whose account is locked cannot sign anything out (Phase 3 rule,
// harmless to enforce now).
export function requireNotLocked(req, res, next) {
  if (req.user?.status === 'locked') {
    return res.status(403).json({ error: 'Account locked — contact an admin' });
  }
  next();
}
