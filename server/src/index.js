import express from 'express';
import cors from 'cors';
import './db.js'; // ensure schema is created on boot

import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import jobRoutes from './routes/jobs.js';
import toolRoutes from './routes/tools.js';
import signoutRoutes from './routes/signouts.js';
import photoRoutes from './routes/photos.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/people', peopleRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/signouts', signoutRoutes);
app.use('/api/photos', photoRoutes);

// JSON 404 + error handler so the client always gets structured errors.
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Tool Tracker API on http://localhost:${PORT}`));
