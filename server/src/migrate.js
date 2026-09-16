// Create the schema (idempotent). Run once after provisioning the database,
// or any time — all statements are CREATE ... IF NOT EXISTS.
//   npm run migrate
import { ensureSchema, pool } from './db.js';

ensureSchema()
  .then(() => { console.log('Schema ready.'); return pool.end(); })
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
