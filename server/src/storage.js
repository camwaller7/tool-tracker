import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Photo object store. Photos are NOT stored inline in the database (PRD §7 /
// PROTOTYPE-REFERENCE): the DB holds only a reference string, the bytes live
// here. This module is the single seam to swap for S3 / Supabase Storage —
// keep the {save, streamPath, ref->path} contract and nothing else changes.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Save raw bytes, return an opaque reference (what gets stored on the record).
export function savePhoto(buffer, mimetype) {
  const ext = mimetype === 'image/png' ? 'png' : mimetype === 'image/webp' ? 'webp' : 'jpg';
  const key = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, key), buffer);
  return `local:${key}`; // reference scheme; e.g. later "s3:bucket/key"
}

// Resolve a reference to an absolute path on disk (local scheme only).
export function refToPath(ref) {
  if (!ref || !ref.startsWith('local:')) return null;
  const key = ref.slice('local:'.length);
  if (key.includes('/') || key.includes('..')) return null; // guard traversal
  const p = path.join(UPLOAD_DIR, key);
  return fs.existsSync(p) ? p : null;
}

export { UPLOAD_DIR };
