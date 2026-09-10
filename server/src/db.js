import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'tool-tracker.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Full data model (DATA-MODEL.md). Phase 1 wires person/job/tool/signout;
// strike/registerEntry/notification tables exist now so Phases 2-3 slot in
// without a schema rewrite. Timestamps are ISO-8601 strings (UTC).
db.exec(`
CREATE TABLE IF NOT EXISTS person (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE,
  email         TEXT UNIQUE,
  pinHash       TEXT NOT NULL,
  isEmployee    INTEGER NOT NULL DEFAULT 1,
  isSupervisor  INTEGER NOT NULL DEFAULT 0,
  isAdmin       INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active',   -- active | supervised | locked
  supervisedUntil TEXT,
  photoRef      TEXT,
  createdAt     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  client    TEXT,
  status    TEXT NOT NULL DEFAULT 'active',       -- active | closed
  createdAt TEXT NOT NULL
);

-- one or more supervisors per job (job.supervisorIds in the data model)
CREATE TABLE IF NOT EXISTS job_supervisor (
  jobId        TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  supervisorId TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  PRIMARY KEY (jobId, supervisorId)
);

CREATE TABLE IF NOT EXISTS tool (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  assetTag         TEXT,
  status           TEXT NOT NULL DEFAULT 'available', -- available|out|pending-signoff|damaged|retired
  currentHolder    TEXT REFERENCES person(id),
  currentJob       TEXT REFERENCES job(id),
  currentSignoutId TEXT,
  retiredReason    TEXT,                              -- lost|stolen|broken
  photoRef         TEXT,                              -- optional "at rest" reference photo
  createdAt        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signout (
  id                 TEXT PRIMARY KEY,
  toolId             TEXT NOT NULL REFERENCES tool(id),
  userId             TEXT NOT NULL REFERENCES person(id),   -- original signer, never changes
  currentResponsible TEXT NOT NULL REFERENCES person(id),
  jobId              TEXT NOT NULL REFERENCES job(id),
  supervisorId       TEXT NOT NULL REFERENCES person(id),
  signOutAt          TEXT NOT NULL,
  signOutPhoto       TEXT NOT NULL,                          -- image ref (required)
  returnAt           TEXT,
  returnPhoto        TEXT,
  condition          TEXT,                                   -- fine | issue
  notes              TEXT,
  supervisorSignoff  TEXT NOT NULL DEFAULT 'n/a',            -- n/a | pending | confirmed
  transferred        TEXT NOT NULL DEFAULT '[]',             -- JSON [{from,to,by,at}]
  overdueProcessedAt TEXT
);

CREATE TABLE IF NOT EXISTS strike (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES person(id),
  signoutId TEXT NOT NULL REFERENCES signout(id),
  issuedAt  TEXT NOT NULL,
  expires   TEXT NOT NULL,                                   -- issuedAt + 100 days
  cleared   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS registerEntry (
  id          TEXT PRIMARY KEY,
  toolId      TEXT NOT NULL REFERENCES tool(id),
  reason      TEXT NOT NULL,                                 -- lost | stolen | broken
  confirmedBy TEXT NOT NULL REFERENCES person(id),
  confirmedAt TEXT NOT NULL,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  id        TEXT PRIMARY KEY,
  type      TEXT NOT NULL,   -- overdue-digest|damage|strike|supervised|locked|signoff-pending
  channel   TEXT NOT NULL,   -- email | sms | push
  recipient TEXT NOT NULL REFERENCES person(id),
  message   TEXT NOT NULL,
  at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_signout_tool     ON signout(toolId, signOutAt);
CREATE INDEX IF NOT EXISTS idx_signout_open      ON signout(returnAt) WHERE returnAt IS NULL;
CREATE INDEX IF NOT EXISTS idx_signout_responsible ON signout(currentResponsible, returnAt);
CREATE INDEX IF NOT EXISTS idx_tool_status       ON tool(status);
CREATE INDEX IF NOT EXISTS idx_strike_user       ON strike(userId);
`);

export default db;
export { DB_PATH };
