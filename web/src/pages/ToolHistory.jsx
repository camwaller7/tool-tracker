import { useEffect, useState } from 'react';
import { api, photoUrl } from '../api.js';
import { StatusBadge, fmtDate, fmtSince, Error } from '../components/ui.jsx';

// Full chronological history for one tool (PRD §4.7): every sign-out, return,
// and transfer, each with its photos and any condition notes. Newest first.
export default function ToolHistory({ params }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/tools/${params.toolId}`).then(setData).catch((e) => setErr(e.message));
  }, [params.toolId]);

  if (err) return <Error>{err}</Error>;
  if (!data) return <p className="center">Loading…</p>;
  const { tool, history } = data;
  const rows = [...history].reverse();

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
            {h.transferred?.length > 0 && (
              <div className="when">{h.transferred.length} transfer(s) logged</div>
            )}
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
