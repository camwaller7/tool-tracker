import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, Error } from '../components/ui.jsx';

const TYPE_ICON = {
  'overdue-digest': '📧',
  damage: '⚠️',
  strike: '⛳',
  supervised: '👀',
  locked: '🔒',
  'signoff-pending': '✅',
};

// Supervisor/admin notifications feed — the audit log of what was sent (the
// real-backend version of the prototype's in-app feed). Admins can also run
// the nightly overdue check on demand.
export default function Notifications({ user }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = () => api.get('/notifications').then(({ notifications }) => setRows(notifications)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function runNightly() {
    setBusy(true); setNote(null); setErr(null);
    try {
      const r = await api.post('/notifications/run-nightly');
      setNote(r.tools === 0 ? 'Nothing out — no digests sent.' : `Sent ${r.supervisors} digest(s) covering ${r.tools} tool(s).`);
      load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div>
      <h2>Notifications</h2>
      <p className="sub">{user.roles.admin ? 'Everything the system has sent.' : 'Alerts sent to you.'}</p>
      <Error>{err}</Error>

      {user.roles.admin && (
        <div className="card">
          <div className="title">End-of-day check</div>
          <p className="meta" style={{ margin: '6px 0 12px' }}>
            Emails each supervisor a digest of tools still out. Runs automatically at 6pm; trigger it here to test.
          </p>
          {note && <div style={{ marginBottom: 10, color: 'var(--brand)' }}>{note}</div>}
          <button className="btn" disabled={busy} onClick={runNightly}>
            {busy ? 'Running…' : 'Run end-of-day check now'}
          </button>
        </div>
      )}

      {rows == null ? (
        <p className="center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="center">No notifications yet.</p>
      ) : (
        <div className="stack">
          {rows.map((n) => (
            <div key={n.id} className="row">
              <span style={{ fontSize: 24 }}>{TYPE_ICON[n.type] || '🔔'}</span>
              <span className="grow">
                <span className="title" style={{ fontSize: 15, whiteSpace: 'pre-wrap' }}>{n.message}</span>
                <span className="meta">
                  {n.channel.toUpperCase()} · {user.roles.admin ? `${n.recipientName} · ` : ''}{fmtDate(n.at)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
