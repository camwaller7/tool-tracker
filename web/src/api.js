// Thin fetch wrapper. Holds the JWT in localStorage and attaches it to every
// request. Throws an Error with the server's message on non-2xx.
const TOKEN_KEY = 'tt_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) {
    payload = body; // let the browser set multipart boundary
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  // Upload a photo, resolve to its storage ref.
  async uploadPhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    const { ref } = await request('POST', '/photos', fd);
    return ref;
  },
};

// Build a src URL for a stored photo ref. In production the ref is a public
// Vercel Blob https URL — use it directly. In local dev it's `local:<key>`
// served back through /api/photos (token passed as a query param since <img>
// can't send an Authorization header).
export function photoUrl(ref) {
  if (!ref) return null;
  if (/^https?:\/\//.test(ref)) return ref;
  const key = ref.startsWith('local:') ? ref.slice(6) : ref;
  const token = getToken();
  return `/api/photos/${key}${token ? `?t=${encodeURIComponent(token)}` : ''}`;
}
