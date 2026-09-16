// Vercel serverless entry. Every /api/* request routes here (catch-all) and is
// handled by the same Express app used for local dev — one function, all routes.
import app from '../server/src/app.js';

export default app;
