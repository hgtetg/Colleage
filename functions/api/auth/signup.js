const COOKIE_NAME = 'colleage_session';
const SESSION_DAYS = 7;
const SERVER_ITERATIONS = 10000;
const PASSWORD_SCHEME = 'client-pbkdf2-v2';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);

  try {
    assertSameOrigin(request);
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const clientSecret = String(body.password || '');
    const role = body.role === 'manager' ? 'manager' : 'student';

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (fullName.length < 2) throw new HttpError(400, 'Enter your full name.');
    if (body.passwordScheme !== PASSWORD_SCHEME || !/^[a-f0-9]{64}$/i.test(clientSecret)) {
      throw new HttpError(400, 'Reload the site and try creating the account again.');
    }

    if (role === 'manager') {
      if (!env.MANAGER_INVITE_CODE) throw new HttpError(403, 'Manager signup is not enabled yet.');
      if (String(body.managerCode || '') !== String(env.MANAGER_INVITE_CODE)) throw new HttpError(403, 'Invalid manager invite code.');
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const id = crypto.randomUUID();
    const { encodedHash, salt } = await hashClientSecret(clientSecret);
    const stage = cleanOptional(body.stage);
    const field = cleanOptional(body.field);
    const institutionType = ['school', 'university'].includes(body.institutionType) ? body.institutionType : null;
    const institutionName = cleanOptional(body.institutionName);

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, password_salt, full_name, role, stage, field, institution_type, institution_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, email, encodedHash, salt, fullName, role, stage, field, institutionType, institutionName).run();

    if (stage && field && institutionType && institutionName) {
      const matched = await env.DB.prepare(`
        SELECT id FROM courses
        WHERE is_public = 0
          AND lower(stage) = lower(?)
          AND lower(field) = lower(?)
          AND institution_type = ?
          AND lower(institution_name) = lower(?)
        LIMIT 1
      `).bind(stage, field, institutionType, institutionName).first();

      if (matched) {
        await env.DB.prepare(`
          INSERT OR IGNORE INTO enrollments (user_id, course_id, position, is_active)
          VALUES (?, ?, 1, 1)
        `).bind(id, matched.id).run();
      }
    }

    const session = await createSession(env.DB, id);
    return json({ user: await publicUser(env.DB, id) }, 201, {
      'Set-Cookie': sessionCookie(session.token, request)
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Signup failed', error);
    if (String(error?.message || '').includes('no such table')) {
      return json({ error: 'Database setup is incomplete. Open /api/setup and initialize the database.' }, 503);
    }
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      return json({ error: 'An account with this email already exists.' }, 409);
    }
    return json({ error: 'Could not create your account. Please try again.' }, 500);
  }
}

async function hashClientSecret(clientSecret) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(clientSecret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: hexToBytes(salt),
    iterations: SERVER_ITERATIONS
  }, key, 256);
  const hash = bytesToHex(new Uint8Array(bits));
  return { encodedHash: `v2$${SERVER_ITERATIONS}$${hash}`, salt };
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
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function cleanOptional(value) {
  if (value === null || value === undefined) return null;
  const output = String(value).trim();
  return output || null;
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
