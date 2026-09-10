# Tool Tracking Software — Product Requirements Document

**Prepared for:** Cambell Waller
**Date:** 10 September 2026 (v2 — all v1 open questions resolved)
**Status:** Draft v2 — ready to move into build planning

---

## 1. Problem Statement

Tools regularly go missing on job sites because there is no reliable record of who took what tool on a given day. When a tool can't be found, there is no quick way to identify who last had it, which wastes time and money and leads to repeat losses. The goal of this software is to make it dead simple for tradespeople to check tools in and out each day, give supervisors instant visibility into what's out and who's responsible, and build in enough accountability that people stop treating tools as no-one's problem.

The tool is aimed at real job-site conditions: used by tradespeople before and after a physical shift, often on a phone, sometimes with patchy reception, and by people who will not tolerate a clunky or slow app. Simplicity beats features everywhere in this build. This version also accounts for running multiple jobs at once, each with its own supervisor.

## 2. Users & Roles

| Role | Who | Key needs |
|---|---|---|
| **Employee / Tradesperson** | Anyone who picks up tools to go to a job site | Fast sign-out in the morning (pick job, supervisor, tools), fast return at day's end, minimal typing |
| **Supervisor / Project Manager** | Runs a specific job and oversees the employees signed under them | See what's out on their job, who has it, get notified of sign-outs/overdue tools/damage, manually transfer tools between people, confirm lost/stolen/broken tools |
| **Admin** (may be the same person as a supervisor, e.g. Cambell) | Owns the tool inventory and job list | Register tools, register employees, register jobs, configure notification recipients and strike rules |

All three roles need to be registered users — there is no anonymous use of the app. Verification of identity (login) is what makes the sign-out record trustworthy enough to hold someone accountable later.

## 3. Core Concepts

- **Tool registry**: every physical tool the business owns exists as one record in the system (name, category, photo, serial/ID tag if used, condition status, current holder if any).
- **Job**: an active job/site the business is running. Jobs are set up by an admin and each has one or more supervisors assigned to it.
- **Sign-out**: the act of an employee selecting the job they're working on today, the supervisor they're working under, and the tool(s) they're taking, then taking a photo of each tool before heading to site. This creates a sign-out record and marks the tool "out," attached to that employee, that job, and that supervisor.
- **Responsibility — permanent, no hand-offs**: the person who signed a tool out is the only one responsible for returning it, for the whole day, no matter who else uses it on site. Employees cannot hand a tool off to each other in the app. The **only** way responsibility for a tool moves to someone else is a supervisor manually transferring it to that person through the app.
- **Return — every night, no exceptions**: every signed-out tool must be physically returned and checked back in at the end of each day, regardless of how long the job runs for. There is no "keep it out overnight for a multi-day job" option — if it's still needed tomorrow, it gets signed out again tomorrow.
- **Overdue tool**: any tool still marked "out" past the end-of-day cutoff, surfaced to supervisors so they can follow up directly with the person responsible.
- **Damaged tool**: a tool reported damaged on return is automatically taken out of the available list and the responsible supervisor is notified immediately. It stays unavailable until a supervisor resolves it (repaired → back to available, or confirmed broken/lost/stolen → retired to the Lost/Stolen/Broken Register).
- **Lost/Stolen/Broken Register**: a permanent historical record of every tool a supervisor has confirmed as lost, stolen, or broken beyond repair. Only supervisors can move a tool into this register; once there, it's removed from the active sign-out list.
- **Strikes**: a running count per employee of days a tool they signed out was not returned. Strikes count within a rolling 100-day window. See Section 4.10 for the exact escalation.

## 4. Key User Flows

### 4.1 Admin: Register a tool
1. Admin adds a new tool: name, category (e.g. power tool, hand tool, ladder, generator), optional photo of the tool "at rest" for reference, optional asset tag/ID.
2. Tool appears immediately in the sign-out list as "available."

### 4.2 Admin: Register a job and assign supervisors
1. Admin creates a job/site record (name, and optionally address/client).
2. Admin assigns one or more supervisors to that job.
3. Job appears in the job-selection list shown to employees at sign-out while it's active, and can be closed/archived by admin when finished.

### 4.3 Admin: Register an employee
1. Admin invites an employee by phone number or email.
2. Employee opens the web app link, verifies via SMS/email code, and their account is active.
3. Keep this to name + phone/email + photo for ID — no more fields than needed.

### 4.4 Employee: Morning sign-out
1. Employee opens the app before heading to a job site.
2. Selects the **job** they're working on today from the list of active jobs.
3. Selects the **supervisor** they're working under for that job (from the supervisors assigned to that job).
4. Sees a list of tools currently marked "available," grouped by category, with a search box.
5. Taps the tool(s) they're taking today (multi-select so one trip covers several tools).
6. For each tool selected, takes a photo of the physical tool right there (proves condition and possession at handover).
7. Confirms sign-out. Each tool's status flips to "out," attached to that employee, that job, and that supervisor, timestamped.
8. That employee now owns the return responsibility for every tool on that list for the rest of the day. This cannot be reassigned by the employee — only a supervisor can move it (Section 4.6).

### 4.5 During the day: Finding a tool
1. Anyone (supervisor or another employee) can search the tool list and see, for any tool marked "out," who currently has it, which job it's signed out to, and since when.
2. This is a read-only lookup — no extra steps, since the point is speed when someone's looking for a missing tool.

### 4.6 Supervisor: Manual tool transfer
1. If a tool genuinely needs to move to someone else on site during the day, only a supervisor can action this in the app — there is no employee-to-employee hand-off.
2. Supervisor opens the tool, selects "transfer," and picks the new responsible employee.
3. The tool's responsibility (and the return obligation) moves to the new employee from that point on; the original sign-out photo and history stay intact, and the transfer itself is logged in the tool's history (Section 4.7) with a timestamp and which supervisor actioned it.

### 4.7 Anyone: Tool history / backlog
1. Every tool has a full chronological history: every sign-out and return, every supervisor-actioned transfer, sign-out/return timestamps, sign-out and return photos, and any condition notes logged at return.
2. If a tool goes missing, a supervisor (or admin) can open that tool's history and scroll back through who had it, on which job, and on which days to narrow down the last confirmed sighting and who to ask first.
3. This is the sign-out/transfer record log (Section 5) surfaced as a simple timeline per tool — no extra data entry required, since it's built automatically from everyday actions.

### 4.8 Employee: End-of-day return
1. Employee opens their "tools I have out today" list (shown automatically — no searching needed, since the app already knows what's on their account, including anything transferred to them).
2. For each tool, taps "return," then **takes a photo of the tool** — this is required before the return can be completed, the same as the sign-out photo, so there's a visual record at both ends of the day.
3. A short checklist of simple checkboxes appears (tap-only, no typing required), e.g.:
   - [ ] Tool working fine
   - [ ] Damaged / needs repair
   - [ ] Missing a part/attachment
   - [ ] Battery/consumable needs replacing
   - [ ] Other issue (optional free-text, never required)
4. If "fine" is checked: tool flips back to "available" and re-enters tomorrow's list — unless the employee is currently in a 30-day supervised return period (Section 4.10), in which case the return sits as "pending" until their supervisor confirms it in the app; only then does the tool go back to available.
5. If any damage/issue box is checked: the tool is **automatically marked unavailable** (it disappears from tomorrow's sign-out list) and the relevant supervisor is **immediately notified by text message** (Section 6). The tool stays unavailable until a supervisor resolves it (Section 4.11).

### 4.9 6pm overdue notification
1. Every day at 6:00pm (site/local time), the system checks for any tool still marked "out" — there are no exceptions for multi-day jobs, since every tool must be returned nightly.
2. Sends a single **email** to the relevant supervisor(s) listing: tool name, who has it, which job, and how long it's been out.
3. Supervisor uses this to follow up directly with that employee.

### 4.10 Strikes & escalation
1. **Strike:** recorded against an employee every time a tool they were responsible for isn't returned by end of day.
2. **100-day rolling window:** only strikes from the last 100 days count toward the total. A strike older than 100 days drops off automatically.
3. **Three strikes within that 100-day window:** the employee is placed into a **30-day supervised return period**. During those 30 days, every return they make must be signed off by their supervisor in the app before the tool is checked back in as returned — the employee can still sign tools out and return them as normal, but the return isn't final/complete until the supervisor confirms it.
4. **Any further failed return once supervised (i.e. a breach of the supervised period):** the employee's account is **locked** — they can no longer sign anything out at all. An admin has to manually unlock the account to restore access; there's no automatic expiry on a lock.
5. Supervisors are notified by **text message** whenever a strike is issued (so they see the pattern building), whenever an employee enters the 30-day supervised period, and whenever an account gets locked.
6. Admin can manually clear a strike, end a supervised period early, or unlock an account (e.g. if a tool was actually returned and just not logged correctly).

### 4.11 Supervisor: Confirming a tool lost, stolen, or broken
1. Only supervisors can make a tool's removal from the active registry permanent.
2. From a tool marked unavailable (via the auto-flag in 4.8, or one a supervisor has been chasing via the overdue notification and can't locate), the supervisor can either:
   - **Resolve/repair** — sends the tool back to "available" (e.g. it was fixed, or the damage report was a false alarm), or
   - **Confirm lost / stolen / broken** — permanently removes the tool from the active sign-out list and adds it to the **Lost/Stolen/Broken Register**, with the reason, date, supervisor who confirmed it, and a link back to its full history for the record.
3. The register is a permanent, browsable history for the business — not something tools ever come back out of.

## 5. Data Model (high level)

**User**
- id, name, phone/email, role (employee/supervisor/admin), status (active/supervised-until-date/locked), strike count, photo

**Job**
- id, name, address/client (optional), status (active/closed), assigned supervisor id(s)

**Tool**
- id, name, category, reference photo, asset tag (optional), status (available / out / damaged-unavailable / retired-lost-stolen-broken), current holder (user id, nullable), current job (id, nullable)

**Sign-out record**
- id, tool id, user id (current responsible party), original signer id, job id, supervisor id, date, sign-out timestamp, sign-out photo, return timestamp (nullable), return condition (fine/damaged/missing part/other), return notes (optional free text), supervisor sign-off (n/a / pending / confirmed — only used during a supervised return period)

**Transfer record**
- id, sign-out record id, tool id, from user id, to user id, actioned by (supervisor id), timestamp

**Strike**
- id, user id, sign-out record id (the one that triggered it), date issued, expires (issued date + 100 days), cleared (bool), cleared by (admin id, nullable)

**Lost/Stolen/Broken Register entry**
- id, tool id, reason (lost/stolen/broken), confirmed by (supervisor id), date confirmed, notes, link to tool's full history

**Notification log**
- id, type (6pm overdue email / strike text / supervised-period text / account-locked text / damage text / return sign-off pending), recipient, channel (email/SMS/push), date/time sent, content summary

## 6. Notifications Summary

| Event | Channel | Recipient |
|---|---|---|
| Daily missing/overdue tools (6pm) | Email | Job's supervisor(s) |
| Tool returned damaged | Text message | Job's supervisor |
| Strike issued | Text message | Job's supervisor |
| Employee enters 30-day supervised return period (3rd strike) | Text message | Job's supervisor |
| Employee account locked (breach during supervised period) | Text message | Job's supervisor |
| Return awaiting supervisor sign-off (during supervised period) | Push/in-app | Job's supervisor |

## 7. Non-Functional Requirements

- **Radically simple UI**: large tap targets, minimal screens, no required typing anywhere in the core sign-out/return flow. Assume users are on a phone, possibly wearing gloves, in a hurry, in daylight glare.
- **Fast**: sign-out and return should each be completable in under 30 seconds per tool, including job/supervisor selection.
- **Mobile-first web app (PWA)**: works in any phone browser, "Add to Home Screen" so it behaves like an app icon without app-store friction — cheaper and faster to ship and update than a native app, with no app-store approval delays.
- **Works on patchy job-site reception**: sign-out/return actions should queue locally and sync when a connection is available, rather than fail outright. Photos should upload in the background.
- **Auth**: every action must be tied to a logged-in, verified user — this is the backbone of accountability, so login needs to be simple (e.g. phone number + PIN, or a magic link) but never skippable.
- **Photo storage**: a sign-out photo and a return photo are both required (never optional) and need to be stored and retrievable against a specific record, in case of a dispute about a tool's condition.
- **Audit trail**: every sign-out, transfer, return, strike, block, and register entry should be logged and browsable per tool as a history/backlog — this is what makes "who had it last, and when did it disappear" answerable at any time.

## 8. Suggested Build Approach

**Recommended stack:** mobile-first Progressive Web App (PWA) — React or similar frontend, a backend with a database (e.g. Supabase or similar) for auth, tool/job/user/sign-out records, and photo storage, plus scheduled jobs for the 6pm notification check and strike/block calculations, and an SMS provider (e.g. Twilio) alongside email for notifications.

**Phased rollout:**
1. **MVP** — admin tool/job/employee registry, sign-out flow with job + supervisor + tool selection + photo, "who has what" lookup, per-tool history/backlog, end-of-day return with checkbox condition report and automatic unavailable-on-damage flag.
2. **Phase 2** — 6pm overdue email to supervisors; damage text alerts; supervisor manual transfer.
3. **Phase 3** — strikes, 100-day window, the 30-day supervised return period with in-app supervisor sign-off, account locking, and the Lost/Stolen/Broken Register with supervisor confirmation flow.
4. **Phase 4 (nice-to-have)** — reporting/analytics (which tools go missing most, which employees have the most strikes, tool utilization by job), multi-site inventory splitting if tools need to be tied to a specific site's stock rather than a shared pool.

Starting at MVP and layering in notifications, transfers, and strikes once the core sign-out/return habit is proven on site is the lowest-risk path — it gets something real in tradespeople's hands fast, which matters more than completeness on day one.

---

*This document reflects the requirements as described by Cambell, finalised 10 September 2026. All open questions from v1 have been resolved and folded into the relevant sections above. Happy to revise further on feedback, or move into a working prototype of the core sign-out/return flow.*
