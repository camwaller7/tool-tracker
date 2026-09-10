import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { PhotoCapture, Error } from '../components/ui.jsx';

// 5-step wizard: job → supervisor → tools → one photo per tool → confirm.
// Back-navigation at every step (PROTOTYPE-REFERENCE). Photo per tool is
// mandatory; confirm is disabled until every selected tool has a photo.
export default function SignOut({ reset }) {
  const [step, setStep] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [tools, setTools] = useState([]);
  const [job, setJob] = useState(null);
  const [supervisorId, setSupervisorId] = useState(null);
  const [selected, setSelected] = useState([]); // toolIds
  const [photos, setPhotos] = useState({}); // toolId -> ref
  const [photoIdx, setPhotoIdx] = useState(0);
  const [q, setQ] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get('/jobs?active=1').then(({ jobs }) => setJobs(jobs)).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (step === 2 && tools.length === 0) {
      api.get('/tools?available=1').then(({ tools }) => setTools(tools)).catch((e) => setErr(e.message));
    }
  }, [step]); // eslint-disable-line

  const grouped = useMemo(() => {
    const filtered = tools.filter((t) =>
      !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.category.toLowerCase().includes(q.toLowerCase())
    );
    const by = {};
    for (const t of filtered) (by[t.category] ||= []).push(t);
    return by;
  }, [tools, q]);

  const selectedTools = selected.map((id) => tools.find((t) => t.id === id)).filter(Boolean);
  const allPhotographed = selected.length > 0 && selected.every((id) => photos[id]);

  function toggle(id) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const items = selected.map((toolId) => ({ toolId, photoRef: photos[toolId] }));
      const res = await api.post('/signouts', { jobId: job.id, supervisorId, items });
      setDone(res.count);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (done != null) {
    return (
      <div className="center">
        <div style={{ fontSize: 56 }}>✅</div>
        <h2>{done} tool{done === 1 ? '' : 's'} signed out</h2>
        <p className="sub">They're now on your account until you return them tonight.</p>
        <button className="btn" onClick={reset}>Done</button>
      </div>
    );
  }

  return (
    <div>
      <Steps step={step} total={4} />
      <Error>{err}</Error>

      {/* Step 0: job */}
      {step === 0 && (
        <>
          <h2>Which job today?</h2>
          {jobs.length === 0 && <p className="center">No active jobs. Ask an admin to set one up.</p>}
          <div className="stack">
            {jobs.map((j) => (
              <button key={j.id} className="row tappable" onClick={() => { setJob(j); setSupervisorId(null); setStep(1); }}>
                <span className="grow">
                  <span className="title">{j.name}</span>
                  {j.client && <span className="meta">{j.client}</span>}
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Step 1: supervisor */}
      {step === 1 && job && (
        <>
          <h2>Working under?</h2>
          <p className="sub">Supervisors on {job.name}.</p>
          <div className="stack">
            {job.supervisors.map((s) => (
              <button
                key={s.id}
                className={`row tappable ${supervisorId === s.id ? 'selected' : ''}`}
                onClick={() => { setSupervisorId(s.id); setStep(2); }}
              >
                <span className="grow"><span className="title">{s.name}</span></span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
          <button className="btn secondary" onClick={() => setStep(0)}>Back</button>
        </>
      )}

      {/* Step 2: tools */}
      {step === 2 && (
        <>
          <h2>Pick your tools</h2>
          <input placeholder="Search tools…" value={q} onChange={(e) => setQ(e.target.value)} />
          {Object.keys(grouped).length === 0 && <p className="center">No available tools match.</p>}
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <div className="group-label">{cat}</div>
              {list.map((t) => (
                <button key={t.id} className={`row tappable ${selected.includes(t.id) ? 'selected' : ''}`} onClick={() => toggle(t.id)}>
                  <span className="check">{selected.includes(t.id) ? '✓' : ''}</span>
                  <span className="grow">
                    <span className="title">{t.name}</span>
                    {t.assetTag && <span className="meta">{t.assetTag}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
          <div style={{ height: 80 }} />
          <div className="footer-action">
            <div className="app-inner">
              <button className="btn" disabled={selected.length === 0} onClick={() => { setPhotoIdx(0); setStep(3); }}>
                Photo {selected.length} tool{selected.length === 1 ? '' : 's'} ›
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: one photo per tool */}
      {step === 3 && (
        <>
          <h2>Photo: {selectedTools[photoIdx]?.name}</h2>
          <p className="sub">Tool {photoIdx + 1} of {selectedTools.length}. Snap it before you head off.</p>
          <PhotoCapture
            key={selectedTools[photoIdx]?.id}
            value={photos[selectedTools[photoIdx]?.id]}
            onChange={(ref) => setPhotos((p) => ({ ...p, [selectedTools[photoIdx].id]: ref }))}
          />
          <div style={{ height: 16 }} />
          <div className="seg">
            <button className="btn secondary" onClick={() => (photoIdx === 0 ? setStep(2) : setPhotoIdx((i) => i - 1))}>Back</button>
            {photoIdx < selectedTools.length - 1 ? (
              <button className="btn" disabled={!photos[selectedTools[photoIdx]?.id]} onClick={() => setPhotoIdx((i) => i + 1)}>Next tool ›</button>
            ) : (
              <button className="btn" disabled={!photos[selectedTools[photoIdx]?.id]} onClick={() => setStep(4)}>Review ›</button>
            )}
          </div>
        </>
      )}

      {/* Step 4: confirm */}
      {step === 4 && (
        <>
          <h2>Confirm sign-out</h2>
          <div className="card">
            <div className="meta">Job</div><div className="title">{job.name}</div>
            <div className="meta" style={{ marginTop: 8 }}>Supervisor</div>
            <div className="title">{job.supervisors.find((s) => s.id === supervisorId)?.name}</div>
          </div>
          <div className="group-label">{selectedTools.length} tools</div>
          {selectedTools.map((t) => (
            <div key={t.id} className="row">
              <span className="check" style={{ background: photos[t.id] ? 'var(--brand)' : '', color: '#04201d' }}>
                {photos[t.id] ? '✓' : '!'}
              </span>
              <span className="grow"><span className="title">{t.name}</span><span className="meta">{photos[t.id] ? 'photo taken' : 'no photo'}</span></span>
            </div>
          ))}
          <div style={{ height: 12 }} />
          <button className="btn" disabled={busy || !allPhotographed} onClick={submit}>
            {busy ? 'Signing out…' : `Confirm — sign out ${selectedTools.length} tool${selectedTools.length === 1 ? '' : 's'}`}
          </button>
          <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => { setPhotoIdx(0); setStep(3); }}>Back to photos</button>
        </>
      )}
    </div>
  );
}

function Steps({ step, total }) {
  return (
    <div className="steps">
      {Array.from({ length: total + 1 }).map((_, i) => (
        <span key={i} className={i <= step ? 'done' : ''} />
      ))}
    </div>
  );
}
