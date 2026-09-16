// Nightly overdue check (PRD §4.9, ROADMAP Phase 2). Replaces the prototype's
// manual "Run end-of-day check" button. Every tool must be returned nightly,
// so anything still `out` at the cutoff is overdue.
//
// Phase 2 scope = the email digest only. Striking overdue tools and the
// escalation rule are Phase 3 and will hook into this same job later (which is
// why overdueProcessedAt is intentionally NOT stamped here yet).
//
// Run once daily at the site-local cutoff (PRD says 6pm). Examples:
//   node src/jobs/nightly.js          # one-off / cron / edge function
//   npm run nightly
import { q, pool } from '../db.js';
import { notify } from '../notify.js';

const hoursOut = (iso) => Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));

export async function runNightly() {
  // Every still-out tool, with who has it and which job.
  const open = await q.all(
    `SELECT s."id", s."supervisorId", s."signOutAt",
            t."name" AS "toolName",
            resp."name" AS "holderName",
            j."name" AS "jobName"
     FROM signout s
     JOIN tool t ON t."id" = s."toolId"
     JOIN person resp ON resp."id" = s."currentResponsible"
     JOIN job j ON j."id" = s."jobId"
     WHERE s."returnAt" IS NULL
     ORDER BY s."supervisorId", s."signOutAt"`
  );

  if (open.length === 0) {
    console.log('[nightly] nothing out — no digests to send.');
    return { supervisors: 0, tools: 0 };
  }

  // Group by the supervisor chosen at sign-out.
  const bySupervisor = new Map();
  for (const row of open) {
    if (!bySupervisor.has(row.supervisorId)) bySupervisor.set(row.supervisorId, []);
    bySupervisor.get(row.supervisorId).push(row);
  }

  for (const [supervisorId, rows] of bySupervisor) {
    const lines = rows.map(
      (r) => `• ${r.toolName} — ${r.holderName} on ${r.jobName} (out ${hoursOut(r.signOutAt)}h)`
    );
    const message =
      `${rows.length} tool${rows.length === 1 ? '' : 's'} still not returned tonight:\n\n` +
      lines.join('\n') +
      `\n\nFollow up with the person responsible.`;
    await notify({
      type: 'overdue-digest',
      channel: 'email',
      recipientId: supervisorId,
      subject: `Overdue tools — ${rows.length} still out`,
      message,
    });
  }

  console.log(`[nightly] sent ${bySupervisor.size} digest(s) covering ${open.length} tool(s).`);
  return { supervisors: bySupervisor.size, tools: open.length };
}

// Run directly when invoked as a script.
if (import.meta.url === `file://${process.argv[1]}`) {
  runNightly()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
