import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}${Date.now().toString(36)}`;
}

export function now() {
  return new Date().toISOString();
}

export function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// PIN hashing with scrypt (no external dep). Format: salt:hash (hex).
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function signToken(person) {
  return jwt.sign({ sub: person.id }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Shape a person row for API responses (never leak pinHash).
export function publicPerson(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    roles: {
      employee: !!p.isEmployee,
      supervisor: !!p.isSupervisor,
      admin: !!p.isAdmin,
    },
    status: p.status,
    supervisedUntil: p.supervisedUntil,
    photoRef: p.photoRef,
  };
}
