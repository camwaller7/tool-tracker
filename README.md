# Site Tool Tracker

Job-site tool sign-out/return tracker for a small trades business. Mandatory
photo-verified sign-out and return, live "who has what" lookup, and a full
per-tool history — so tools stop going missing.

It's a mobile-first **PWA**: open the link on a phone, "Add to Home Screen,"
and it behaves like an installed app — no app store. A QR code just points at
the deployed URL.

This repo covers **Phase 1 (MVP)** and **Phase 2 (notifications & transfers)**
from `ROADMAP.md`. Phase 3 (strikes → supervised → lock, and the
lost/stolen/broken register) is next; the database schema is already the full
data model, so it slots in without a rewrite.

## Stack

Deployed **all on Vercel**:

| Concern | What | Notes |
|---|---|---|
| Frontend | React + Vite PWA | static build served by Vercel |
| API | Express, run as a Vercel serverless function | single catch-all function at `api/[...path].js` |
| Database | Postgres (Vercel Postgres / Neon) | `pg`; connection from `POSTGRES_URL` |
| Photos | Vercel Blob | DB stores only the blob URL; falls back to local disk in dev |
| Auth | phone/email + PIN, JWT, enforced server-side | swappable |
| Nightly job | Vercel Cron → `/api/cron/nightly` | daily overdue digest |
| SMS / email | Twilio + SMTP | audit-logged; sends for real when creds are set |

## Running locally

Needs Node 18+ and a local Postgres (or point `POSTGRES_URL` at any Postgres).

```bash
# 0. Copy env and set POSTGRES_URL
cp .env.example .env    # edit POSTGRES_URL if needed

# 1. API (port 4000)
npm install
npm run migrate         # create tables
npm run seed            # Port Lincoln sample data
npm run dev

# 2. Frontend (port 5173, proxies /api to the backend)
cd web && npm install && npm run dev
```

Open http://localhost:5173. Everyone's PIN is `1234`.

| Name | Role | Login |
|---|---|---|
| Cambell Waller | admin + supervisor | `0400000001` |
| Dave Nguyen | supervisor | `0400000002` |
| Sam Torres | employee | `0400000004` |
| Tom Fletcher | supervised employee | `0400000007` |

`npm run nightly` runs the overdue digest by hand.

## Deploying to Vercel

1. **Import the repo** into Vercel (or let the connected integration create the
   project). No build settings needed — `vercel.json` handles build, output,
   the API function, and the daily cron.
2. **Add storage** (Vercel dashboard → the project → Storage):
   - Create/connect a **Postgres** database → injects `POSTGRES_URL`.
   - Create/connect a **Blob** store → injects `BLOB_READ_WRITE_TOKEN`.
3. **Set env vars** (Settings → Environment Variables):
   - `JWT_SECRET` — any long random string (required).
   - `CRON_SECRET` — any long random string (protects the nightly cron).
   - Optional: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` for
     real SMS; `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` /
     `SMTP_FROM` for real email.
4. **Redeploy.** The schema is created automatically on first request. To load
   sample data, run `npm run seed` locally with `POSTGRES_URL` pointed at the
   Vercel database (or start fresh and add real tools/people in the admin
   screen).
5. The production URL is your QR target.

The cron in `vercel.json` runs daily at 08:00 UTC (~5:30–6:30pm Port Lincoln
depending on daylight saving); adjust the schedule to taste.

## What's covered

**Phase 1** — auth (roles enforced server-side); admin registers tools, jobs
(with supervisors), and people; sign-out wizard (job → supervisor → tools →
photo per tool → confirm); "my tools"; return (photo → fine/issue → auto-flag
damaged); find-a-tool with live status; per-tool photo history.

**Phase 2** — nightly overdue email digest, damage-alert SMS, supervisor manual
transfer, and a notifications feed. Every notification writes an audit row and
sends for real when provider creds are configured (see `server/src/notify.js`).

See `ROADMAP.md` for the full phase plan.

## Layout

```
api/[...path].js   Vercel serverless entry → the Express app
server/src/        Express app, routes, Postgres layer, Blob storage, jobs
web/               React PWA (Vite)
vercel.json        build + function + cron config
```
