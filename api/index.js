// Vercel serverless entry. All /api/* requests are rewritten to this single
// function (see vercel.json) and handled by the same Express app used for local
// dev. Vercel preserves the original request URL, so Express routing (/api/auth/
// login, /api/tools/:id, /api/cron/nightly, …) works unchanged.
import app from '../server/src/app.js';

export default app;
