# Site Tool Tracker

Job-site tool sign-out/return tracker for a small construction/trades business (multiple concurrent jobs, each with its own supervisor). Tools go missing because there's no record of who took what — this app fixes that with mandatory photo-verified sign-out/return, per-tool history, and an accountability system (strikes → supervised returns → account lock) for people who don't bring tools back.

Read these docs in this order before writing code:

1. **`PRD.md`** — the full product spec. This is the source of truth for behavior. If code and this doc disagree, the doc wins unless the user says otherwise.
2. **`DATA-MODEL.md`** — entities, fields, and the business rules that constrain them (strike windows, status transitions, etc.). Use this to design the real database schema.
3. **`ROADMAP.md`** — the phased build order. Build in this order; don't jump to Phase 3 features before Phase 1 is solid.
4. **`PROTOTYPE-REFERENCE.md`** — a working click-through prototype already exists (a single-file HTML app using a shared JSON document store) and encodes every flow's exact UX and business logic. Treat it as executable spec for interaction behavior — when a screen or rule is ambiguous in the PRD, check what the prototype actually does.

## Locked-in decisions (do not re-litigate these without asking the user)

- **No employee-to-employee hand-offs.** Whoever signs a tool out owns returning it, no matter who uses it on site. Only a supervisor can reassign responsibility (a manual transfer), never the employee.
- **Every tool is returned every night**, regardless of job length. There is no "carry it overnight" option.
- **A photo is mandatory at both sign-out and return.** Neither action can be completed without one.
- **Damage auto-pulls the tool from rotation.** A damaged/issue return immediately flags the tool unavailable and texts the supervisor — no admin step needed to hide it from tomorrow's list.
- **Strikes: 3 in a rolling 100-day window** → the employee enters a **30-day supervised return period** (every return needs supervisor sign-off in-app before the tool goes back on the shelf) → **any further missed return during that period locks the account** (admin-only manual unlock, no auto-expiry on a lock).
- **Multi-job support**: at sign-out, the employee picks the job they're on today and the supervisor they're working under for that job. Jobs have one or more assigned supervisors.
- **Notification channels are fixed**: 6pm overdue-tools digest → email; damage reports, strike issued, supervised-period started, account locked → text message (SMS); supervisor sign-off needed → push/in-app is acceptable, SMS is fine too if that's simpler to build first.
- **Only supervisors** (not admins acting outside that role, and never employees) can: transfer a tool mid-day, confirm a damaged tool as repaired, or confirm a tool lost/stolen/broken into the permanent register.

## Recommended stack (from the PRD, not mandatory — confirm with the user before deviating)

Mobile-first PWA (installable via "Add to Home Screen," no app store). React (or similar) frontend; backend with a real database (Postgres via Supabase is a reasonable default — it also bundles auth and file storage for the sign-out/return photos); a scheduled job (cron/edge function) for the nightly overdue check and strike/lock escalation; Twilio (or similar) for SMS, any transactional email provider for the daily digest.

## What's already validated vs. what's still open

Validated by the working prototype and confirmed by the user: all flows in the PRD, including the return-photo requirement.

Still genuinely open (ask before assuming): real auth method (phone+PIN vs magic link vs something else), exact SMS/email provider, whether jobs/tools are ever split per physical site vs. one shared inventory, and anything the PRD's own "no longer open questions" section doesn't cover once you're deep in implementation — new edge cases will surface; when they do, resolve them the way the prototype resolved the equivalent case, or ask.
