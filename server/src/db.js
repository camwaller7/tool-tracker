import pg from 'pg';

// Postgres data layer. camelCase columns are quoted in DDL so Postgres
// preserves their case — `SELECT *` then returns rows whose keys match the
// JS field names the rest of the app already uses (row.signOutAt, etc.).
//
// Connection comes from POSTGRES_URL (injected by the Vercel Postgres/Neon
// integration in prod; set to a local Postgres in dev — see .env.example).

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] POSTGRES_URL not set — the API will fail until it is.');
}

// Neon/Vercel require TLS; a local Postgres does not.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || '');
export const pool = new Pool({
  connectionString,
  ssl: connectionString && !isLocal ? { rejectUnauthorized: false } : false,
  max: 3, // small pool — serverless invocations are short-lived
});

// Query helpers mirroring the old better-sqlite3 shape.
export const q = {
  async all(text, params = []) {
    const res = await pool.query(text, params);
    return res.rows;
  },
  async one(text, params = []) {
    const res = await pool.query(text, params);
    return res.rows[0];
  },
  async run(text, params = []) {
    return pool.query(text, params);
  },
  // Transaction: fn receives a `t` with the same one/all/run bound to a single
  // client, wrapped in BEGIN/COMMIT (ROLLBACK on throw).
  async tx(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const t = {
        all: async (text, params = []) => (await client.query(text, params)).rows,
        one: async (text, params = []) => (await client.query(text, params)).rows[0],
        run: (text, params = []) => client.query(text, params),
      };
      const result = await fn(t);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS person (
  "id"             TEXT PRIMARY KEY,
  "name"           TEXT NOT NULL,
  "phone"          TEXT UNIQUE,
  "email"          TEXT UNIQUE,
  "pinHash"        TEXT NOT NULL,
  "isEmployee"     BOOLEAN NOT NULL DEFAULT TRUE,
  "isSupervisor"   BOOLEAN NOT NULL DEFAULT FALSE,
  "isAdmin"        BOOLEAN NOT NULL DEFAULT FALSE,
  "status"         TEXT NOT NULL DEFAULT 'active',
  "supervisedUntil" TIMESTAMPTZ,
  "photoRef"       TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "client"    TEXT,
  "status"    TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS job_supervisor (
  "jobId"        TEXT NOT NULL REFERENCES job("id") ON DELETE CASCADE,
  "supervisorId" TEXT NOT NULL REFERENCES person("id") ON DELETE CASCADE,
  PRIMARY KEY ("jobId", "supervisorId")
);

CREATE TABLE IF NOT EXISTS tool (
  "id"               TEXT PRIMARY KEY,
  "name"             TEXT NOT NULL,
  "category"         TEXT NOT NULL,
  "assetTag"         TEXT,
  "status"           TEXT NOT NULL DEFAULT 'available',
  "currentHolder"    TEXT REFERENCES person("id"),
  "currentJob"       TEXT REFERENCES job("id"),
  "currentSignoutId" TEXT,
  "retiredReason"    TEXT,
  "photoRef"         TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS signout (
  "id"                 TEXT PRIMARY KEY,
  "toolId"             TEXT NOT NULL REFERENCES tool("id"),
  "userId"             TEXT NOT NULL REFERENCES person("id"),
  "currentResponsible" TEXT NOT NULL REFERENCES person("id"),
  "jobId"              TEXT NOT NULL REFERENCES job("id"),
  "supervisorId"       TEXT NOT NULL REFERENCES person("id"),
  "signOutAt"          TIMESTAMPTZ NOT NULL,
  "signOutPhoto"       TEXT NOT NULL,
  "returnAt"           TIMESTAMPTZ,
  "returnPhoto"        TEXT,
  "condition"          TEXT,
  "notes"              TEXT,
  "supervisorSignoff"  TEXT NOT NULL DEFAULT 'n/a',
  "transferred"        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "overdueProcessedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS strike (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES person("id"),
  "signoutId" TEXT NOT NULL REFERENCES signout("id"),
  "issuedAt"  TIMESTAMPTZ NOT NULL,
  "expires"   TIMESTAMPTZ NOT NULL,
  "cleared"   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS "registerEntry" (
  "id"          TEXT PRIMARY KEY,
  "toolId"      TEXT NOT NULL REFERENCES tool("id"),
  "reason"      TEXT NOT NULL,
  "confirmedBy" TEXT NOT NULL REFERENCES person("id"),
  "confirmedAt" TIMESTAMPTZ NOT NULL,
  "notes"       TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  "id"        TEXT PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "channel"   TEXT NOT NULL,
  "recipient" TEXT NOT NULL REFERENCES person("id"),
  "message"   TEXT NOT NULL,
  "at"        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signout_tool ON signout("toolId", "signOutAt");
CREATE INDEX IF NOT EXISTS idx_signout_open ON signout("returnAt") WHERE "returnAt" IS NULL;
CREATE INDEX IF NOT EXISTS idx_signout_responsible ON signout("currentResponsible", "returnAt");
CREATE INDEX IF NOT EXISTS idx_tool_status ON tool("status");
CREATE INDEX IF NOT EXISTS idx_strike_user ON strike("userId");
`;

// Idempotent. Cached so a warm serverless instance runs it once, and repeated
// deploys are cheap (all CREATE ... IF NOT EXISTS).
let schemaPromise = null;
export function ensureSchema() {
  if (!schemaPromise) schemaPromise = pool.query(SCHEMA);
  return schemaPromise;
}
