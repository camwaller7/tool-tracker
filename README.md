# Site Tool Tracker

Job-site tool sign-out/return tracker for a small trades business. Mandatory
photo-verified sign-out and return, live "who has what" lookup, and a full
per-tool history — so tools stop going missing.

This repo covers **Phase 1 (MVP)** and **Phase 2 (notifications & transfers)**
from `ROADMAP.md`: the daily sign-out/return habit, plus the nightly overdue
email digest, damage-alert SMS, and supervisor manual transfers. The
accountability system (strikes → supervised → lock) is Phase 3. The database
schema is already the full data model, so Phase 3 slots in without a migration
rewrite.

## Stack (and why)

The PRD recommends a Supabase-backed PWA. To keep this repo **runnable today
with zero external provisioning** and portable, Phase 1 uses:

| Concern | Phase 1 choice | Swap path |
|---|---|---|
| Backend | Node + Express | — |
| Database | SQLite (via `better-sqlite3`) — a real, indexed relational DB | Point the data layer at Postgres/Supabase |
| Auth | phone/email + PIN, JWT session, enforced server-side | Magic link / Supabase Auth |
| Photo storage | local disk object store; DB holds only a reference | `server/src/storage.js` → S3 / Supabase Storage |
| Frontend | React + Vite, mobile-first, installable PWA | — |

These three items (auth method, DB/host, photo store) are the genuinely-open
decisions from `CLAUDE.md`. The code isolates each behind one module so the
decision can be changed without touching business logic.

## Running locally

```bash
# 1. Backend (port 4000)
cd server
npm install
npm run seed      # creates tool-tracker.db with the Port Lincoln sample data
npm run dev

# 2. Frontend (port 5173, proxies /api to the backend)
cd web
npm install
npm run dev
```

Open http://localhost:5173. Log in with any seeded person's phone/email and
PIN (see the seed output, or `server/src/seed.js`). Default PIN for every
seeded user is `1234`.

### Sample logins (from the seed)

| Name | Role | Login | PIN |
|---|---|---|---|
| Cambell Waller | admin + supervisor | `0400000001` | `1234` |
| Dave Nguyen | supervisor | `0400000002` | `1234` |
| Sam Torres | employee | `0400000004` | `1234` |

## What Phase 1 covers

- Auth: employees, supervisors, admins log in (PIN), roles enforced server-side.
- Admin: register tools, jobs (with supervisor assignment), and people/roles.
- Employee sign-out wizard: job → supervisor → multi-select tools → one photo
  per tool → confirm.
- "My tools": everything currently signed out to you.
- Return flow: mandatory photo → fine / issue → issue checkboxes → confirm.
  A damaged/issue return automatically flags the tool unavailable.
- Find-a-tool: search + live status (who has it, since when, which job).
- Per-tool history: every sign-out/return in order, with photos.

## What Phase 2 adds

- **Nightly overdue digest** (`npm run nightly` in `server/`, or POST
  `/api/notifications/run-nightly` as an admin, or the "Run end-of-day check"
  button in the Notifications screen). Emails each supervisor the tools still
  out under them. Schedule it at 6pm site-local via cron / an edge function.
- **Damage-alert SMS** — a damaged/issue return immediately texts the
  responsible supervisor.
- **Supervisor manual transfer** — from a tool that's currently out, a
  supervisor/admin reassigns responsibility to another person; logged in the
  tool's history.
- **Notifications feed** — supervisors see alerts sent to them; admins see all.

### Notification delivery

Every notification writes an audit row (`notification` table) regardless of
delivery. Delivery is real when the relevant env vars are set, and logs to the
console otherwise — so the app is fully functional in dev with nothing to
configure. Set these to send for real (see `server/.env.example`):

| Channel | Provider | Env vars |
|---|---|---|
| SMS | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| Email | SMTP (any) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |

Both live behind `server/src/notify.js` — swap the adapter, not the callers, to
change provider.

See `ROADMAP.md` for the full phase plan.

## Layout

```
server/   Express API, SQLite schema + seed, photo object store
web/      React PWA (Vite)
```
