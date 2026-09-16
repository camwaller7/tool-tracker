import { Router } from 'express';
import { q } from '../db.js';
import { requireAuth, requireSupervisor, requireAdmin } from '../middleware.js';
import { runNightly } from '../jobs/nightly.js';

const router = Router();

// Supervisor/admin: the notification audit feed (reverse-chron).
router.get('/', requireAuth, requireSupervisor, async (req, res, next) => {
  try {
    const rows = req.user.isAdmin
      ? await q.all(
          `SELECT n.*, p."name" AS "recipientName" FROM notification n
           JOIN person p ON p."id" = n."recipient" ORDER BY n."at" DESC LIMIT 100`
        )
      : await q.all(
          `SELECT n.*, p."name" AS "recipientName" FROM notification n
           JOIN person p ON p."id" = n."recipient"
           WHERE n."recipient" = $1 ORDER BY n."at" DESC LIMIT 100`,
          [req.user.id]
        );
    res.json({ notifications: rows });
  } catch (e) { next(e); }
});

// Admin: manually run the nightly overdue check (prototype's "Run end-of-day
// check" button). In production Vercel Cron calls /api/cron/nightly instead.
router.post('/run-nightly', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await runNightly();
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
});

export default router;
