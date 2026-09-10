import { useState } from 'react';
import { api } from '../api.js';
import { PhotoCapture, Error } from '../components/ui.jsx';

const ISSUES = [
  { key: 'damaged', label: 'Damaged / needs repair' },
  { key: 'missingPart', label: 'Missing a part/attachment' },
  { key: 'consumable', label: 'Battery/consumable needs replacing' },
  { key: 'other', label: 'Other issue' },
];

// Return flow (PRD §4.8): mandatory photo → "all good" vs "there's an issue"
// → tap-only issue checkboxes + optional note → confirm. Confirm is disabled
// until both a photo and a condition are set.
export default function ReturnTool({ params, back, reset }) {
  const item = params.item;
  const [photo, setPhoto] = useState(null);
  const [condition, setCondition] = useState(null); // 'fine' | 'issue'
  const [issues, setIssues] = useState([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  if (!item) return <p className="center">Nothing to return.</p>;

  const canConfirm = photo && condition && (condition === 'fine' || issues.length > 0 || note.trim());

  function toggleIssue(key) {
    setIssues((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await api.post(`/signouts/${item.signoutId}/return`, {
        returnPhoto: photo,
        condition,
        issues: condition === 'issue' ? issues : undefined,
        note: note.trim() || undefined,
      });
      setResult(res.toolStatus);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const damaged = result === 'damaged';
    const pending = result === 'pending-signoff';
    return (
      <div className="center">
        <div style={{ fontSize: 56 }}>{damaged ? '⚠️' : '✅'}</div>
        <h2>{item.toolName} returned</h2>
        <p className="sub">
          {damaged
            ? 'Flagged as damaged and pulled from tomorrow\'s list. Your supervisor will be notified.'
            : pending
            ? 'Return recorded — waiting on your supervisor to sign it off.'
            : 'Checked back in and available again.'}
        </p>
        <button className="btn" onClick={reset}>Done</button>
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={back}>Back to my tools</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{item.toolName}</h2>
      <p className="sub">{item.jobName}</p>
      <Error>{err}</Error>

      <label>1. Photo of the tool</label>
      <PhotoCapture value={photo} onChange={setPhoto} label="Take a return photo" />

      <label>2. Condition</label>
      <div className="seg">
        <button className={condition === 'fine' ? 'on-ok' : ''} onClick={() => { setCondition('fine'); setIssues([]); }}>
          👍 All good
        </button>
        <button className={condition === 'issue' ? 'on-issue' : ''} onClick={() => setCondition('issue')}>
          ⚠️ There's an issue
        </button>
      </div>

      {condition === 'issue' && (
        <div className="checklist" style={{ marginTop: 16 }}>
          <div className="group-label">What's wrong? (tap all that apply)</div>
          {ISSUES.map((i) => (
            <button key={i.key} className={`row ${issues.includes(i.key) ? 'selected' : ''}`} onClick={() => toggleIssue(i.key)}>
              <span className="check">{issues.includes(i.key) ? '✓' : ''}</span>
              <span className="grow"><span className="title">{i.label}</span></span>
            </button>
          ))}
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else…" />
        </div>
      )}

      <div style={{ height: 20 }} />
      <button className={`btn ${condition === 'issue' ? 'danger' : ''}`} disabled={!canConfirm || busy} onClick={submit}>
        {busy ? 'Returning…' : condition === 'issue' ? 'Report issue & return' : 'Confirm return'}
      </button>
    </div>
  );
}
