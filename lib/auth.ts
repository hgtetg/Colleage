const encoder = new TextEncoder();
// Cloudflare Web Crypto supports PBKDF2 iteration counts up to 100,000.
const ITERATIONS = 100_000;
const SESSION_DAYS = 30;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(
  password: string,
  salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),
) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(salt),
      iterations: ITERATIONS,
    },
    key,
    256,
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt };
}

export async function verifyPassword(
  password: string,
  expected: string,
  salt: string,
) {
  const result = await hashPassword(password, salt);
  const left = base64ToBytes(result.hash);
  const right = base64ToBytes(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
}

export function readCookie(request: Request, name: string) {
  for (const item of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return null;
}

export function sessionCookie(request: Request, token: string | null) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return token
    ? `campus_session=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
    : `campus_session=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`;
}

export async function createSession(db: D1Database, userId: string) {
  const token = randomToken(36);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 86400_000,
  ).toISOString();
  await db
    .prepare(
      `INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)`,
    )
    .bind(tokenHash, userId, expiresAt)
    .run();
  return token;
}

export async function deleteSession(db: D1Database, request: Request) {
  const token = readCookie(request, 'campus_session');
  if (token)
    await db
      .prepare(`DELETE FROM sessions WHERE token_hash = ?`)
      .bind(await sha256(token))
      .run();
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  if (origin !== new URL(request.url).origin)
    throw new Response('Invalid request origin.', { status: 403 });
}

export async function checkRateLimit(
  db: D1Database,
  key: string,
  maximum = 8,
  minutes = 15,
) {
  const now = new Date();
  const row = await db
    .prepare(
      `SELECT count,window_started_at,blocked_until FROM auth_attempts WHERE attempt_key = ?`,
    )
    .bind(key)
    .first<{
      count: number;
      window_started_at: string;
      blocked_until: string | null;
    }>();
  if (row?.blocked_until && new Date(row.blocked_until) > now) return false;
  const windowExpired =
    !row ||
    now.getTime() - new Date(row.window_started_at).getTime() >
      minutes * 60_000;
  const count = windowExpired ? 1 : row.count + 1;
  const blockedUntil =
    count > maximum
      ? new Date(now.getTime() + minutes * 60_000).toISOString()
      : null;
  await db
    .prepare(
      `INSERT INTO auth_attempts (attempt_key,count,window_started_at,blocked_until) VALUES (?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET count=excluded.count,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until`,
    )
    .bind(
      key,
      count,
      windowExpired ? now.toISOString() : row!.window_started_at,
      blockedUntil,
    )
    .run();
  return count <= maximum;
}

export async function clearRateLimit(db: D1Database, key: string) {
  await db
    .prepare(`DELETE FROM auth_attempts WHERE attempt_key = ?`)
    .bind(key)
    .run();
}

export function passwordIsStrong(password: string) {
  return (
    password.length >= 10 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}
