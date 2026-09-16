import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireSupervisor, requireAdmin } from '../middleware.js';
import { runNightly } from '../jobs/nightly.js';

const router = Router();

// Supervisor/admin: the notification audit feed (reverse-chron). This is the
// real-backend equivalent of the prototype's in-app notifications feed — a log
// of what was sent and when.
router.get('/', requireAuth, requireSupervisor, (req, res) => {
  // Supervisors see notifications addressed to them; admins see everything.
  const rows = req.user.isAdmin
    ? db.prepare(
        `SELECT n.*, p.name AS recipientName FROM notification n
         JOIN person p ON p.id = n.recipient ORDER BY n.at DESC LIMIT 100`
      ).all()
    : db.prepare(
        `SELECT n.*, p.name AS recipientName FROM notification n
         JOIN person p ON p.id = n.recipient
         WHERE n.recipient = ? ORDER BY n.at DESC LIMIT 100`
      ).all(req.user.id);
  res.json({ notifications: rows });
});

// Admin: manually run the nightly overdue check (the prototype's "Run
// end-of-day check" button). In production a cron/edge function calls
// runNightly() on a schedule instead.
router.post('/run-nightly', requireAuth, requireAdmin, async (_req, res) => {
  const result = await runNightly();
  res.json({ ok: true, ...result });
});

export default router;
