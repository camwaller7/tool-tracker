import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Error } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(identifier.trim(), pin.trim());
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar"><h1>Tool Tracker</h1></header>
      <main className="content">
        <h2>Sign in</h2>
        <p className="sub">Use your phone number or email and your PIN.</p>
        <form onSubmit={submit}>
          <Error>{err}</Error>
          <label htmlFor="id">Phone or email</label>
          <input
            id="id" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username" inputMode="email" placeholder="0400 000 000"
          />
          <label htmlFor="pin">PIN</label>
          <input
            id="pin" value={pin} onChange={(e) => setPin(e.target.value)}
            type="password" inputMode="numeric" autoComplete="current-password" placeholder="••••"
          />
          <div style={{ height: 20 }} />
          <button className="btn" disabled={busy || !identifier || !pin}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 24, fontSize: 14 }}>
          Sample: 0400000004 / PIN 1234 (see README for more).
        </p>
      </main>
    </div>
  );
}
