const COOKIE_NAME = 'colleage_session';
const SESSION_DAYS = 7;
const PASSWORD_SCHEME = 'client-pbkdf2-v2';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const clientSecret = String(body.password || '');

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (body.passwordScheme !== PASSWORD_SCHEME || !/^[a-f0-9]{64}$/i.test(clientSecret)) {
      throw new HttpError(400, 'Reload the site and try signing in again.');
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) throw new HttpError(401, 'Invalid email or password.');

    if (!(await verifyClientSecret(clientSecret, user.password_salt, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const session = await createSession(env.DB, user.id);
    return json({ user: await publicUser(env.DB, user.id) }, 200, {
      'Set-Cookie': sessionCookie(session.token, request)
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Login failed', error);
    if (String(error?.message || '').includes('no such table')) {
      return json({ error: 'Database setup is incomplete. Open /api/setup and initialize the database.' }, 503);
    }
    return json({ error: 'Could not sign in. Please try again.' }, 500);
  }
}

async function verifyClientSecret(clientSecret, salt, encodedHash) {
  const match = /^v2\$(\d+)\$([a-f0-9]{64})$/i.exec(String(encodedHash || ''));
  if (!match) return false;

  const iterations = Number(match[1]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > 50000) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clientSecret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(String(salt || '')),
    iterations
  }, key, 256);
  const actual = bytesToHex(new Uint8Array(bits));
  return constantTimeEqual(actual, match[2].toLowerCase());
}

async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run();
  return { token };
}

function publicUser(db, id) {
  return db.prepare(`
    SELECT id, email, full_name AS fullName, photo_url AS photoUrl, role, stage, field,
           institution_type AS institutionType, institution_name AS institutionName, created_at AS createdAt
    FROM users WHERE id = ?
  `).bind(id).first();
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function randomToken(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bytesToHex(bytes) {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2) return new Uint8Array();
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function readJson(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    throw new HttpError(415, 'Send JSON with Content-Type: application/json.');
  }
  try { return await request.json(); }
  catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw new HttpError(403, 'Cross-origin write blocked.');
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
