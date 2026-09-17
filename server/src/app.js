import express from 'express';
import cors from 'cors';
import { ensureSchema } from './db.js';
import { runNightly } from './jobs/nightly.js';

import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import jobRoutes from './routes/jobs.js';
import toolRoutes from './routes/tools.js';
import signoutRoutes from './routes/signouts.js';
import photoRoutes from './routes/photos.js';
import notificationRoutes from './routes/notifications.js';
import setupRoutes from './routes/setup.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Ensure the schema exists before handling any API request (idempotent, cached
// per instance). Makes first-deploy migration automatic.
app.use('/api', async (_req, res, next) => {
  try {
    await ensureSchema();
    next();
  } catch (e) {
    console.error('[schema]', e);
    res.status(500).json({ error: 'Database not ready' });
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Vercel Cron hits this daily (see vercel.json). Vercel signs cron requests
// with `Authorization: Bearer $CRON_SECRET`; require it so the endpoint can't
// be triggered by the public.
app.get('/api/cron/nightly', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const result = await runNightly();
  res.json({ ok: true, ...result });
});

app.use('/api/auth', authRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/signouts', signoutRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/setup', setupRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

export default app;
