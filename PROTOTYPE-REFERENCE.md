# Working Prototype — Reference

**Live app:** https://claude.ai/code/artifact/4695629f-b239-46e5-84a1-5222c7236d2d

A single-file HTML/JS click-through prototype of the full flow, built and approved before this handoff. It's not the codebase to build from directly (no real auth, no real backend, no real SMS/email — see below), but every interaction, screen, and business rule in it has already been reviewed and confirmed, so **use it as the executable spec for exact behavior** whenever the PRD or data model leaves something ambiguous — open the link and try the flow rather than guessing.

It's seeded with a sample dataset (a small Port Lincoln trades business: 2 active jobs + 1 closed, 14 tools, 7 people including one employee already in a supervised period) so it opens already showing real activity. Use the identity switcher (top-right pill) to view it as different roles.

## What it proves out (build these the same way)

- **Sign-out wizard**: job → supervisor (filtered to that job's assigned supervisors) → multi-select tools → one photo per tool → confirm. Back-navigation at every step.
- **Return flow**: mandatory photo → "all good" vs. "there's an issue" → tap-only issue checkboxes + optional note → confirm (disabled until both a photo and a condition choice are set).
- **Find a tool**: search/browse, tap into a tool to see live status and its full timeline (every sign-out, transfer, and return, each with its photo).
- **Supervisor transfer**: only reachable from a tool that's currently `out`, only for supervisors/admins, reassigns `currentResponsible` and appends to the tool's history.
- **Supervisor sign-off queue**: appears only for returns from someone in a supervised period; confirming flips the tool back to available.
- **Needs attention / register**: a damaged tool gets "mark repaired" or "confirm lost/stolen/broken" actions; confirming asks for a reason and notes, then permanently retires the tool.
- **Notifications feed**: a simple reverse-chron log — this is what a real notification-sending job should be writing to (see `DATA-MODEL.md`'s `notification` entity).
- **Admin management**: add/list tools, jobs (with supervisor assignment), and people; clear strikes or restore a locked account.

## What's simulated and needs a real implementation

| In the prototype | In the real build |
|---|---|
| Identity switcher (pick who you are from a list) | Real authentication — decide method (phone+PIN, magic link, etc.) and enforce it server-side |
| "Run end-of-day check" manual button | A real scheduled job (cron/edge function) firing nightly — see `DATA-MODEL.md`'s scheduled-job section |
| Notifications just logged to an in-app feed | Actual SMS (Twilio or similar) and email sending, triggered from the scheduled job and the relevant write paths (damage report, strike, etc.) |
| Photos stored as small inline compressed thumbnails on the record itself | Real object storage (S3/Supabase Storage/etc.) with the record holding a reference, so full-resolution photos aren't a database bloat problem |
| Shared JSON document store with no real query indexes | A real relational (or otherwise indexed) database per `DATA-MODEL.md`, so "all overdue signouts," "all of X's strikes," etc. are efficient queries, not full scans |

## Known gaps worth deciding early (not blocking, but don't let them surprise you late)

- Multi-tool sign-out currently takes one photo per tool in sequence — fine for a handful of tools, worth confirming it stays usable if someone signs out ten+ at once.
- The prototype's "supervisor" on a signout is whoever the employee picked at sign-out time, not necessarily every supervisor assigned to that job — the PRD's 6pm digest and damage/strike texts all go to that one chosen supervisor. If Cambell wants those going to *all* of a job's supervisors instead, that's a small, clear change to make early rather than after the notification job is built.
