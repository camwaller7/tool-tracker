import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge, Error, roleLabel } from '../components/ui.jsx';

const CATEGORIES = ['power tool', 'hand tool', 'access', 'measuring', 'generator', 'other'];

export default function Admin({ navigate }) {
  const [tab, setTab] = useState('tools');
  return (
    <div>
      <div className="tabbar">
        {['tools', 'jobs', 'people'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'tools' && <ToolsTab navigate={navigate} />}
      {tab === 'jobs' && <JobsTab />}
      {tab === 'people' && <PeopleTab />}
    </div>
  );
}

function ToolsTab({ navigate }) {
  const [tools, setTools] = useState([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [assetTag, setAssetTag] = useState('');
  const [err, setErr] = useState(null);
  const load = () => api.get('/tools').then(({ tools }) => setTools(tools)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/tools', { name, category, assetTag: assetTag || undefined });
      setName(''); setAssetTag(''); load();
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <div>
      <form className="card" onSubmit={add}>
        <div className="group-label">Register a tool</div>
        <Error>{err}</Error>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Makita Drill" />
        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label>Asset tag (optional)</label>
        <input value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="PT-001" />
        <div style={{ height: 12 }} />
        <button className="btn" disabled={!name}>Add tool</button>
      </form>
      <div className="group-label">{tools.length} tools</div>
      {tools.map((t) => (
        <button key={t.id} className="row tappable" onClick={() => navigate('history', { toolId: t.id, title: t.name })}>
          <span className="grow"><span className="title">{t.name}</span><span className="meta">{t.category}{t.assetTag ? ` · ${t.assetTag}` : ''}</span></span>
          <StatusBadge status={t.status} />
        </button>
      ))}
    </div>
  );
}

function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [supers, setSupers] = useState([]);
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [picked, setPicked] = useState([]);
  const [err, setErr] = useState(null);
  const load = () => api.get('/jobs').then(({ jobs }) => setJobs(jobs)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    api.get('/people/supervisors').then(({ people }) => setSupers(people)).catch(() => {});
  }, []);

  async function add(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/jobs', { name, client: client || undefined, supervisorIds: picked });
      setName(''); setClient(''); setPicked([]); load();
    } catch (e2) { setErr(e2.message); }
  }
  async function close(id) {
    try { await api.post(`/jobs/${id}/close`); load(); } catch (e2) { setErr(e2.message); }
  }
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div>
      <form className="card" onSubmit={add}>
        <div className="group-label">Register a job</div>
        <Error>{err}</Error>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marina Berth Rebuild" />
        <label>Client (optional)</label>
        <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Port Lincoln Marina" />
        <label>Assign supervisors</label>
        {supers.length === 0 && <p className="meta">No supervisors yet — add one under People.</p>}
        {supers.map((s) => (
          <button type="button" key={s.id} className={`row ${picked.includes(s.id) ? 'selected' : ''}`} onClick={() => toggle(s.id)}>
            <span className="check">{picked.includes(s.id) ? '✓' : ''}</span>
            <span className="grow"><span className="title">{s.name}</span></span>
          </button>
        ))}
        <div style={{ height: 12 }} />
        <button className="btn" disabled={!name || picked.length === 0}>Add job</button>
      </form>
      <div className="group-label">{jobs.length} jobs</div>
      {jobs.map((j) => (
        <div key={j.id} className="row">
          <span className="grow">
            <span className="title">{j.name} {j.status === 'closed' && <span className="badge retired">closed</span>}</span>
            <span className="meta">{[j.client, j.supervisors.map((s) => s.name).join(', ')].filter(Boolean).join(' · ')}</span>
          </span>
          {j.status === 'active' && <button className="btn ghost" style={{ width: 'auto', minHeight: 40, padding: '6px 12px' }} onClick={() => close(j.id)}>Close</button>}
        </div>
      ))}
    </div>
  );
}

function PeopleTab() {
  const [people, setPeople] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [roles, setRoles] = useState({ supervisor: false, admin: false });
  const [err, setErr] = useState(null);
  const load = () => api.get('/people').then(({ people }) => setPeople(people)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post('/people', { name, phone: phone || undefined, email: email || undefined, pin, roles });
      setName(''); setPhone(''); setEmail(''); setPin(''); setRoles({ supervisor: false, admin: false }); load();
    } catch (e2) { setErr(e2.message); }
  }

  return (
    <div>
      <form className="card" onSubmit={add}>
        <div className="group-label">Register a person</div>
        <Error>{err}</Error>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Torres" />
        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="0400 000 000" />
        <label>Email (optional)</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="sam@example.com" />
        <label>Starting PIN</label>
        <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="1234" />
        <label>Roles</label>
        <button type="button" className={`row ${roles.supervisor ? 'selected' : ''}`} onClick={() => setRoles((r) => ({ ...r, supervisor: !r.supervisor }))}>
          <span className="check">{roles.supervisor ? '✓' : ''}</span><span className="grow"><span className="title">Supervisor</span></span>
        </button>
        <button type="button" className={`row ${roles.admin ? 'selected' : ''}`} onClick={() => setRoles((r) => ({ ...r, admin: !r.admin }))}>
          <span className="check">{roles.admin ? '✓' : ''}</span><span className="grow"><span className="title">Admin</span></span>
        </button>
        <p className="meta">Everyone can sign tools out. Tick extra roles as needed.</p>
        <div style={{ height: 12 }} />
        <button className="btn" disabled={!name || !pin || (!phone && !email)}>Add person</button>
      </form>
      <div className="group-label">{people.length} people</div>
      {people.map((p) => (
        <div key={p.id} className="row">
          <span className="grow">
            <span className="title">{p.name}</span>
            <span className="meta">{roleLabel(p)}{p.status !== 'active' ? ` · ${p.status}` : ''} · {p.phone || p.email}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
