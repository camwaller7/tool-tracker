import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Home({ navigate, user }) {
  const [outCount, setOutCount] = useState(null);

  useEffect(() => {
    api.get('/signouts/mine').then(({ items }) => setOutCount(items.length)).catch(() => {});
  }, []);

  const tiles = [
    { name: 'signout', icon: '🔧', title: 'Sign out tools', sub: 'Pick a job and take your tools' },
    { name: 'mytools', icon: '📋', title: 'My tools', sub: outCount == null ? 'Return your tools' : `${outCount} out — return them` },
    { name: 'find', icon: '🔍', title: 'Find a tool', sub: 'Who has what, right now' },
  ];
  if (user.roles.admin) {
    tiles.push({ name: 'admin', icon: '⚙️', title: 'Admin', sub: 'Tools, jobs and people' });
  }

  return (
    <div>
      <h2>Hi {user.name.split(' ')[0]} 👋</h2>
      <p className="sub">What do you need to do?</p>
      {user.status === 'supervised' && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          You're in a <strong>supervised return period</strong> — your returns need a
          supervisor's sign-off before a tool goes back on the shelf.
        </div>
      )}
      <div className="stack">
        {tiles.map((t) => (
          <button key={t.name} className="row tappable" onClick={() => navigate(t.name)}>
            <span style={{ fontSize: 28 }}>{t.icon}</span>
            <span className="grow">
              <span className="title">{t.title}</span>
              <span className="meta">{t.sub}</span>
            </span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
