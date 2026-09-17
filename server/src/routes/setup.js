import { Router } from 'express';
import { q, ensureSchema } from '../db.js';
import { newId, now, hashPin, publicPerson } from '../util.js';
import { seedDemo } from '../seed.js';

const router = Router();

// One-time initialization for a fresh deployment. Protected by SETUP_SECRET
// (falls back to CRON_SECRET). Refuses once any people exist, so it can never
// wipe or overwrite real data.
//
//   POST /api/setup                      -> creates a single admin (clean start)
//        body: { name, phone, email, pin }
//   POST /api/setup?demo=true            -> loads the Port Lincoln sample data
//
// Auth: header  Authorization: Bearer <SETUP_SECRET or CRON_SECRET>
router.post('/', async (req, res, next) => {
  try {
    const secret = process.env.SETUP_SECRET || process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await ensureSchema();
    const force = req.query.force === 'true' || req.body?.force === true;
    const { count } = await q.one('SELECT count(*)::int AS count FROM person');
    if (count > 0 && !force) {
      return res.status(409).json({ error: 'Already initialized. Pass ?force=true (with the secret) to wipe and re-initialize.' });
    }
    // force + clean-admin mode needs an explicit wipe (demo mode wipes itself).
    const wipe = () => q.run('TRUNCATE notification, strike, "registerEntry", signout, job_supervisor, tool, job, person CASCADE');

    // Demo mode: full sample dataset.
    if (req.query.demo === 'true' || req.body?.demo === true) {
      await seedDemo();
      return res.json({
        ok: true,
        mode: 'demo',
        message: 'Sample data loaded. Everyone\'s PIN is 1234.',
        logins: [
          { name: 'Cambell Waller', role: 'admin+supervisor', login: '0400000001' },
          { name: 'Dave Nguyen', role: 'supervisor', login: '0400000002' },
          { name: 'Sam Torres', role: 'employee', login: '0400000004' },
        ],
      });
    }

    // Clean mode: create one admin so a real rollout can start empty.
    const { name, phone, email, pin } = req.body || {};
    if (!pin) return res.status(400).json({ error: 'pin required' });
    if (!phone && !email) return res.status(400).json({ error: 'phone or email required' });

    if (force) await wipe();
    const id = newId('person');
    await q.run(
      `INSERT INTO person ("id","name","phone","email","pinHash","isEmployee","isSupervisor","isAdmin","status","createdAt")
       VALUES ($1,$2,$3,$4,$5,TRUE,TRUE,TRUE,'active',$6)`,
      [id, (name || 'Admin').trim(), phone?.trim() || null, email?.trim().toLowerCase() || null, hashPin(pin), now()]
    );
    const person = await q.one('SELECT * FROM person WHERE "id" = $1', [id]);
    res.json({ ok: true, mode: 'admin', admin: publicPerson(person), message: 'Admin created. Log in and add your tools, jobs and people.' });
  } catch (e) { next(e); }
});

export default router;
