import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge, fmtSince, Error } from '../components/ui.jsx';

// Read-only lookup: search/browse tools and see live status — who has it,
// which job, since when (PRD §4.5). Tap through to the full history.
export default function FindTool({ navigate }) {
  const [q, setQ] = useState('');
  const [tools, setTools] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => {
      api.get(`/tools${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then(({ tools }) => setTools(tools))
        .catch((e) => setErr(e.message));
    }, 150);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div>
      <h2>Find a tool</h2>
      <input placeholder="Search by name, category or tag…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <Error>{err}</Error>
      <div style={{ height: 12 }} />
      {tools.map((t) => (
        <button key={t.id} className="row tappable" onClick={() => navigate('history', { toolId: t.id, title: t.name })}>
          <span className="grow">
            <span className="title">{t.name}</span>
            <span className="meta">
              {t.status === 'out' && t.holder
                ? `${t.holder.name} · ${t.job?.name || ''} · ${fmtSince(t.since)}`
                : t.category}
            </span>
          </span>
          <StatusBadge status={t.status} />
        </button>
      ))}
      {tools.length === 0 && <p className="center">No tools found.</p>}
    </div>
  );
}
