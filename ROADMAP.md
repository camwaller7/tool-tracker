# Build Roadmap

Phased from PRD Section 8. Each phase should be a usable, shippable increment on its own — don't start Phase 2 work before Phase 1 is solid on a real job site.

## Phase 1 — MVP: the daily habit
Goal: replace "nobody knows who has the drill" with a working sign-out/return log. No automation yet — that's Phase 2+.

- [ ] Auth: employees, supervisors, and admins can log in (decide the method — see `CLAUDE.md`'s open questions)
- [ ] Admin: register tools (name, category, asset tag)
- [ ] Admin: register jobs (name, client, status) and assign supervisors to each
- [ ] Admin: register people and assign roles
- [ ] Employee: sign-out flow — pick job → pick supervisor (from that job's assigned supervisors) → multi-select tools → mandatory photo per tool → confirm
- [ ] Employee: "my tools" — see everything currently signed out to them
- [ ] Employee: return flow — mandatory photo → fine/issue → checkboxes if issue → confirm
- [ ] Damaged return automatically flags the tool unavailable (no admin step required)
- [ ] Anyone: find-a-tool search + live status (who has it, since when, which job)
- [ ] Anyone: per-tool history/backlog (every sign-out/return with photos, in order)
- [ ] Photo storage wired to real object storage, not inline in the database

## Phase 2 — Notifications & transfers
- [ ] Nightly scheduled job: find all still-`out` tools, real email digest to the relevant supervisor(s)
- [ ] Damaged-return SMS to the relevant supervisor, sent for real
- [ ] Supervisor: manual tool transfer (reassign `currentResponsible`, logged in tool history)

## Phase 3 — Accountability system
- [ ] Strike creation wired into the nightly job (one per unreturned tool)
- [ ] 100-day rolling strike window (strikes stop counting once expired, but are kept for audit)
- [ ] 3-strikes → 30-day supervised return period, real SMS to supervisor
- [ ] Supervisor sign-off queue: returns from a supervised employee sit pending until confirmed
- [ ] Breach during supervised period → account locked, real SMS to supervisor
- [ ] Admin: clear strikes, end supervision early, unlock an account
- [ ] Lost/Stolen/Broken Register: supervisor confirms repaired vs. permanently retires a tool with a reason; register is a permanent, browsable, append-only history

## Phase 4 — Nice-to-have, only after Phases 1–3 are proven on real jobs
- [ ] Reporting/analytics: tools that go missing most, employees with the most strikes, utilization by job
- [ ] Multi-site inventory splitting, if tools ever need to be tied to a specific site's stock rather than one shared pool
- [ ] Anything else that comes up once real usage surfaces real pain points — don't pre-build this phase speculatively

## Cross-cutting, do throughout (not a separate phase)
- Keep the identity/permission checks server-side, not just hidden in the UI — an employee should not be able to call the "transfer" or "confirm lost/stolen/broken" endpoints directly even if the button isn't shown to them.
- Every write that matters for accountability (sign-out, return, transfer, strike, lock, register entry) should be append-only / auditable — never silently overwritten.
- Test the mobile UI on an actual phone outdoors before calling a phase done — this app lives or dies on being fast and usable one-handed in daylight.
