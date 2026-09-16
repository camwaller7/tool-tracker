import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Photo object store. The DB holds only a reference string; the bytes live in
// object storage. In production (BLOB_READ_WRITE_TOKEN set) that's Vercel Blob
// and the ref is the public https URL. In dev with no token it's local disk
// and the ref is `local:<key>`, served back through /api/photos.
//
// This module is the single seam for the storage backend — callers just get a
// ref and render it via the frontend's photoUrl().

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

if (!useBlob) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function extFor(mimetype) {
  return mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
}

export async function savePhoto(buffer, mimetype) {
  const key = `photos/${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${extFor(mimetype)}`;
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(key, buffer, {
      access: 'public',
      contentType: mimetype,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return url; // https://...blob.vercel-storage.com/photos/...
  }
  const name = key.replace('photos/', '');
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `local:${name}`;
}

// Resolve a local ref to an absolute path (local scheme only; Blob refs are
// served by their own URL and never hit this).
export function refToPath(ref) {
  if (!ref || !ref.startsWith('local:')) return null;
  const key = ref.slice('local:'.length);
  if (key.includes('/') || key.includes('..')) return null;
  const p = path.join(UPLOAD_DIR, key);
  return fs.existsSync(p) ? p : null;
}

export { UPLOAD_DIR };
