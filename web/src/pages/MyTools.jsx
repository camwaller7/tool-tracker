import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtSince, Error } from '../components/ui.jsx';

export default function MyTools({ navigate }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/signouts/mine').then(({ items }) => setItems(items)).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Error>{err}</Error>;
  if (items == null) return <p className="center">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="center">
        <div style={{ fontSize: 48 }}>🎉</div>
        <p>Nothing signed out to you. You're all clear.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Tools to return</h2>
      <p className="sub">Everything on your account. Tap one to check it back in.</p>
      <div className="stack">
        {items.map((it) => (
          <button key={it.signoutId} className="row tappable" onClick={() => navigate('return', { item: it, title: 'Return tool' })}>
            <span className="grow">
              <span className="title">{it.toolName}</span>
              <span className="meta">{it.jobName} · out {fmtSince(it.signOutAt)}</span>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
