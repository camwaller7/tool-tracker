import { useEffect, useState } from 'react';
import { api, photoUrl } from '../api.js';
import { StatusBadge, fmtDate, fmtSince, Error } from '../components/ui.jsx';

// Full chronological history for one tool (PRD §4.7): every sign-out, return,
// and transfer, each with its photos and any condition notes. Newest first.
// Supervisors/admins can transfer an out tool to another person (PRD §4.6).
export default function ToolHistory({ params, user }) {
  const [data, setData] = useState(null);
  const [people, setPeople] = useState([]);
  const [err, setErr] = useState(null);
  const [transferring, setTransferring] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const canSupervise = user.roles.supervisor || user.roles.admin;

  function load() {
    api.get(`/tools/${params.toolId}`).then(setData).catch((e) => setErr(e.message));
  }
  useEffect(() => {
    load();
    api.get('/people').then(({ people }) => setPeople(people)).catch(() => {});
  }, [params.toolId]);

  if (err) return <Error>{err}</Error>;
  if (!data) return <p className="center">Loading…</p>;
  const { tool, history } = data;
  const rows = [...history].reverse();
  const nameOf = (id) => people.find((p) => p.id === id)?.name || 'someone';

  // The open sign-out (if the tool is out) is the row with no returnAt.
  const openRow = history.find((h) => !h.returnAt);

  async function transferTo(personId) {
    if (!openRow) return;
    setBusyId(personId); setErr(null);
    try {
      await api.post(`/signouts/${openRow.id}/transfer`, { toUserId: personId });
      setTransferring(false);
      load();
    } catch (e) { setErr(e.message); } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="grow">
            <div className="title" style={{ fontSize: 20 }}>{tool.name}</div>
            <div className="meta">{tool.category}{tool.assetTag ? ` · ${tool.assetTag}` : ''}</div>
          </div>
          <StatusBadge status={tool.status} />
        </div>
        {tool.status === 'out' && tool.holder && (
          <p className="meta" style={{ marginTop: 10 }}>
            Held by <strong>{tool.holder.name}</strong> on {tool.job?.name} · out {fmtSince(tool.since)}
          </p>
        )}
        {tool.status === 'retired' && (
          <p className="meta" style={{ marginTop: 10 }}>Retired — {tool.retiredReason}</p>
        )}

        {/* Supervisor transfer — only for an out tool */}
        {canSupervise && tool.status === 'out' && openRow && (
          <div style={{ marginTop: 14 }}>
            {!transferring ? (
              <button className="btn secondary" onClick={() => setTransferring(true)}>
                Transfer responsibility
              </button>
            ) : (
              <div>
                <div className="group-label">Transfer to</div>
                {people
                  .filter((p) => p.id !== tool.holder?.id && p.status !== 'locked')
                  .map((p) => (
                    <button key={p.id} className="row tappable" disabled={busyId === p.id} onClick={() => transferTo(p.id)}>
                      <span className="grow">
                        <span className="title">{p.name}</span>
                        <span className="meta">{p.status !== 'active' ? p.status : ''}</span>
                      </span>
                      <span className="chev">{busyId === p.id ? '…' : '›'}</span>
                    </button>
                  ))}
                <button className="btn ghost" onClick={() => setTransferring(false)}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="group-label">History ({rows.length})</div>
      {rows.length === 0 && <p className="center">No activity yet.</p>}
      <div className="timeline">
        {rows.map((h) => (
          <div className="tl-item" key={h.id}>
            <div className="title">{h.signer.name}</div>
            <div className="when">{h.job?.name} · under {h.supervisor.name}</div>
            <div className="when">Out {fmtDate(h.signOutAt)}{h.returnAt ? ` · Back ${fmtDate(h.returnAt)}` : ' · still out'}</div>
            {h.condition && (
              <div style={{ marginTop: 4 }}>
                {h.condition === 'issue'
                  ? <span className="badge damaged">issue</span>
                  : <span className="badge available">fine</span>}
                {h.notes && <span className="meta"> — {h.notes}</span>}
              </div>
            )}
            {h.transferred?.map((t, i) => (
              <div className="when" key={i}>↪ transferred to {nameOf(t.to)} by {nameOf(t.by)} · {fmtDate(t.at)}</div>
            ))}
            <div className="thumbs">
              {h.signOutPhoto && <img src={photoUrl(h.signOutPhoto)} alt="Sign-out" />}
              {h.returnPhoto && <img src={photoUrl(h.returnPhoto)} alt="Return" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
