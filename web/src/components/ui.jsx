import { useRef, useState } from 'react';
import { api, photoUrl } from '../api.js';

// Top bar with optional back button, title, and identity pill.
export function TopBar({ title, onBack, user, onLogout }) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="back" onClick={onBack} aria-label="Back">‹</button>
      )}
      <h1>{title}</h1>
      {user && (
        <button className="pill" onClick={onLogout} title="Log out">
          <span>{user.name.split(' ')[0]}</span>
          <small>{roleLabel(user)}</small>
        </button>
      )}
    </header>
  );
}

export function roleLabel(u) {
  if (u.roles.admin) return 'admin';
  if (u.roles.supervisor) return 'supervisor';
  return 'employee';
}

export function Error({ children }) {
  if (!children) return null;
  return <div className="error">{children}</div>;
}

export function StatusBadge({ status }) {
  const label = status === 'pending-signoff' ? 'pending sign-off' : status;
  return <span className={`badge ${status}`}>{label}</span>;
}

// Downscale/compress a captured image to keep uploads small (fast on patchy
// reception, and well under the serverless request-body limit). Falls back to
// the original file if anything goes wrong.
async function compressImage(file, maxDim = 1600, quality = 0.7) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

// Camera-first photo input. Opens the camera on mobile, uploads immediately,
// and calls onChange(ref). Mandatory-photo enforcement lives in the parent.
export function PhotoCapture({ value, onChange, label = 'Take photo' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [preview, setPreview] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const ref = await api.uploadPhoto(compressed);
      onChange(ref);
    } catch (e2) {
      setErr(e2.message);
      onChange(null);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const shown = preview || (value && photoUrl(value));
  return (
    <div>
      <button
        type="button"
        className="photo-box"
        onClick={() => inputRef.current?.click()}
        style={{ width: '100%', border: 0, padding: 0, cursor: 'pointer' }}
      >
        {shown ? (
          <img src={shown} alt="Tool" />
        ) : (
          <span className="hint">
            <span className="cam-icon">📷</span>
            {label}
          </span>
        )}
        {busy && <span className="uploading">Uploading…</span>}
      </button>
      {shown && !busy && (
        <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={() => inputRef.current?.click()}>
          Retake photo
        </button>
      )}
      {err && <Error>{err}</Error>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export function fmtSince(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))} min ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}
