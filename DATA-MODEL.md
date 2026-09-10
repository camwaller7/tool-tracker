# Data Model

This expands PRD Section 5 into field-level detail, and matches the collection names/fields already used in the working prototype (see `PROTOTYPE-REFERENCE.md`) so behavior and schema stay in sync. Treat entity names as collections/tables and fields as columns; adapt types to whatever the real backend uses (this was written against a schemaless JSON store, so tighten types — enums, foreign keys, timestamps — as you formalize it).

## person (user)
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| name | string | |
| phone / email | string | at least one, used for login |
| role | enum: `employee`, `supervisor`, `admin` | a supervisor can also be an admin; treat as two independent booleans if that's cleaner |
| status | enum: `active`, `supervised`, `locked` | see strike escalation below |
| supervisedUntil | timestamp, nullable | set when status becomes `supervised`; cleared when it lifts |
| strikeCount (derived) | int | don't store as a raw counter — compute from active (non-expired, non-cleared) rows in `strike`, since strikes expire individually on a rolling window |

## job
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| name | string | |
| client | string, optional | |
| status | enum: `active`, `closed` | closed jobs stop appearing in the sign-out job picker |
| supervisorIds | string[] (fk → person) | one or more; shown as the supervisor choices at sign-out for this job |

## tool
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| name | string | |
| category | string | power tool / hand tool / access / measuring / generator / other |
| assetTag | string, optional | |
| status | enum: `available`, `out`, `pending-signoff`, `damaged`, `retired` | see status machine below |
| currentHolder | fk → person, nullable | |
| currentJob | fk → job, nullable | |
| currentSignoutId | fk → signout, nullable | the open signout record responsible for the current `out`/`pending-signoff`/`damaged` state |
| retiredReason | enum: `lost`, `stolen`, `broken`, nullable | set when status becomes `retired`; the permanent detail lives on the `registerEntry` row |

**Tool status machine:**
`available` → (sign-out) → `out` → (return, condition fine, signer not supervised) → `available`
`out` → (return, condition fine, signer supervised) → `pending-signoff` → (supervisor confirms) → `available`
`out` / `pending-signoff` → (return, condition issue) → `damaged` → (supervisor: repaired) → `available`
`damaged` → (supervisor: confirm lost/stolen/broken) → `retired` (terminal — a retired tool never returns to the active pool)

## signout
The core accountability record — one row per tool per sign-out event.

| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| toolId | fk → tool | |
| userId | fk → person | **the original signer** — permanent, never changes |
| currentResponsible | fk → person | who owes the return right now; equals `userId` unless a supervisor transferred it |
| jobId | fk → job | |
| supervisorId | fk → person | the supervisor chosen at sign-out for this job |
| signOutAt | timestamp | |
| signOutPhoto | image ref (required, not null) | |
| returnAt | timestamp, nullable | null while the tool is still out |
| returnPhoto | image ref, nullable | **required at return** — populate together with `returnAt` |
| condition | enum: `fine`, `issue`, nullable | set at return |
| notes | text, nullable | which issue checkbox(es) were ticked, plus optional free text |
| supervisorSignoff | enum: `n/a`, `pending`, `confirmed` | `pending` only while the returning employee is in a supervised period; the tool doesn't go back to `available` until this flips to `confirmed` |
| transferred | array of `{from, to, by, at}` | append-only log of supervisor-actioned transfers; `currentResponsible` always mirrors the last entry's `to` (or `userId` if empty) |
| overdueProcessedAt | timestamp, nullable | internal bookkeeping so the nightly job only strikes an unreturned tool once |

A tool's full history (PRD 4.7) is just every `signout` row where `toolId` matches, ordered by `signOutAt` — no separate history table needed.

## strike
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| userId | fk → person | |
| signoutId | fk → signout | the specific unreturned tool that caused it |
| issuedAt | timestamp | |
| expires | timestamp | `issuedAt + 100 days`; a strike stops counting toward escalation once this passes, but keep the row for audit history — don't delete it |
| cleared | boolean | admin override; a cleared strike never counts, regardless of `expires` |

**Escalation rule (evaluate whenever a new strike is issued, using the person's *current* status, not raw strike count):**
- Count strikes where `cleared = false` and `expires > now`.
- If the person's status is `active` and the count reaches 3 → status becomes `supervised`, `supervisedUntil = now + 30 days`.
- If the person's status is already `supervised` and *any* further tool goes unreturned → status becomes `locked` immediately (don't wait for a strike count — one breach during supervision is enough).
- If status is `supervised` and `supervisedUntil` has passed with no further breach → status reverts to `active`.
- `locked` only clears via explicit admin action (no automatic expiry).

## registerEntry (Lost / Stolen / Broken Register)
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| toolId | fk → tool | |
| reason | enum: `lost`, `stolen`, `broken` | |
| confirmedBy | fk → person (supervisor or admin) | |
| confirmedAt | timestamp | |
| notes | text, optional | |

Permanent and append-only — nothing here is ever deleted or reversed. "Un-retiring" a tool isn't a feature; if it's a mistake, admins fix it manually and note why.

## notification (log)
| Field | Type | Notes |
|---|---|---|
| id | string (pk) | |
| type | enum: `overdue-digest`, `damage`, `strike`, `supervised`, `locked`, `signoff-pending` | |
| channel | enum: `email`, `sms`, `push` | see PRD Section 6 for which type uses which channel |
| recipient | fk → person (a supervisor) | |
| message | text | |
| at | timestamp | |

This is a delivery log, not a queue — write one row per notification actually sent (or attempted) so there's an audit trail of what supervisors were told and when. In production this is written by whatever job/handler actually calls the SMS/email provider, not by client code.

## Scheduled job (nightly, replaces the prototype's manual "Run end-of-day check" button)
Once daily (PRD says 6pm, site-local time):
1. Find every `signout` with `returnAt = null` and `overdueProcessedAt = null`.
2. Group by `supervisorId`, send one `overdue-digest` email per supervisor listing tool/employee/hours-out.
3. For each such signout: create a `strike`, stamp `overdueProcessedAt`, send a `strike` SMS to that signout's supervisor.
4. Re-run the escalation rule above for every employee who got a new strike this run.
5. Separately (can run in the same job or its own tick): flip any `supervised` person back to `active` once `supervisedUntil` has passed with no new strike.
