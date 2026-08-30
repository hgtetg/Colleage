import { campusCourseId, ensureDatabase, getDb, getViewer, readCampusState } from '@/lib/campus-db';

const json = (body: unknown, init: ResponseInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(body), { ...init, headers });
};

const textValue = (value: unknown) => typeof value === 'string' ? value : '';

export async function GET(request: Request) {
  try {
    return json(await readCampusState(request));
  } catch (error) {
    console.error('Campus GET failed', error);
    return json({ error: 'The Campus Hub service is temporarily unavailable.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    await ensureDatabase(db);
    const body = await request.json() as Record<string, unknown>;
    const action = textValue(body.action);

    if (action === 'join') {
      const fullName = textValue(body.fullName).trim().replace(/\s+/g, ' ');
      const email = textValue(body.email).trim().toLowerCase();
      const code = textValue(body.code).trim().toUpperCase();
      const role = body.role === 'representative' ? 'representative' : 'student';
      if (fullName.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter your full name and a valid email address.' }, { status: 400 });
      const joinCode = await db.prepare(`SELECT id, course_id, role, status FROM join_codes WHERE code = ?`).bind(code).first<{ id: string; course_id: string; role: string; status: string }>();
      if (!joinCode || joinCode.status !== 'active' || joinCode.role !== role) return json({ error: 'This course code is not active for the selected role.' }, { status: 400 });
      const existing = await db.prepare(`SELECT id FROM users WHERE email = ?`).bind(email).first<{ id: string }>();
      const userId = existing?.id ?? crypto.randomUUID();
      const initials = fullName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
      await db.batch([
        db.prepare(`INSERT INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET full_name = excluded.full_name, initials = excluded.initials`).bind(userId, email, fullName, initials),
        db.prepare(`INSERT INTO memberships (user_id, course_id, role) VALUES (?, ?, ?) ON CONFLICT(user_id, course_id) DO UPDATE SET role = excluded.role`).bind(userId, joinCode.course_id, role),
        db.prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, userId, expiresAt),
        db.prepare(`INSERT INTO audit_logs (id, course_id, user_id, action, detail) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), joinCode.course_id, userId, 'member_joined', `${fullName} joined as ${role}`),
      ]);
      const response = json({ ok: true });
      const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
      response.headers.append('set-cookie', `campus_session=${encodeURIComponent(token)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=2592000`);
      return response;
    }

    if (action === 'logout') {
      const token = request.headers.get('cookie')?.match(/(?:^|;\s*)campus_session=([^;]+)/)?.[1];
      if (token) await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(decodeURIComponent(token)).run();
      const response = json({ ok: true });
      const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
      response.headers.append('set-cookie', `campus_session=; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=0`);
      return response;
    }

    const viewer = await getViewer(request, db);
    if (!viewer) return json({ error: 'Join the course before making changes.' }, { status: 401 });

    if (action === 'create_post') {
      const text = textValue(body.text).trim();
      if (text.length < 2 || text.length > 1000) return json({ error: 'Posts must be between 2 and 1,000 characters.' }, { status: 400 });
      await db.prepare(`INSERT INTO posts (id, course_id, user_id, body, pinned) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), campusCourseId, viewer.id, text, viewer.role === 'representative' && body.pinned ? 1 : 0).run();
      return json({ ok: true });
    }

    if (action === 'book_room') {
      const roomId = textValue(body.roomId);
      const room = await db.prepare(`SELECT id FROM rooms WHERE id = ?`).bind(roomId).first<{ id: string }>();
      if (!room) return json({ error: 'That study room does not exist.' }, { status: 404 });
      const existing = await db.prepare(`SELECT id FROM bookings WHERE room_id = ? AND user_id = ?`).bind(roomId, viewer.id).first<{ id: string }>();
      if (existing) {
        await db.prepare(`DELETE FROM bookings WHERE id = ?`).bind(existing.id).run();
      } else {
        const start = new Date(Date.now() + 86_400_000); start.setHours(14, 30, 0, 0);
        const end = new Date(start.getTime() + 3_600_000);
        await db.prepare(`INSERT INTO bookings (id, room_id, user_id, starts_at, ends_at) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), roomId, viewer.id, start.toISOString(), end.toISOString()).run();
      }
      return json({ ok: true });
    }

    if (viewer.role !== 'representative') return json({ error: 'Representative permission is required.' }, { status: 403 });

    if (action === 'toggle_code') {
      const status = body.status === 'paused' ? 'paused' : 'active';
      await db.prepare(`UPDATE join_codes SET status = ? WHERE course_id = ? AND role = 'student'`).bind(status, campusCourseId).run();
      await db.prepare(`INSERT INTO audit_logs (id, course_id, user_id, action, detail) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), campusCourseId, viewer.id, 'join_code_status', `Student join code set to ${status}`).run();
      return json({ ok: true });
    }

    if (action === 'regenerate_code') {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const suffix = Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => alphabet[byte % alphabet.length]).join('');
      const nextCode = `DSA2-${suffix}`;
      await db.batch([
        db.prepare(`UPDATE join_codes SET status = 'invalid' WHERE course_id = ? AND role = 'student'`).bind(campusCourseId),
        db.prepare(`INSERT INTO join_codes (id, course_id, code, role, status) VALUES (?, ?, ?, 'student', 'active')`).bind(crypto.randomUUID(), campusCourseId, nextCode),
        db.prepare(`INSERT INTO audit_logs (id, course_id, user_id, action, detail) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), campusCourseId, viewer.id, 'join_code_regenerated', `Student join code changed to ${nextCode}`),
      ]);
      return json({ ok: true, code: nextCode });
    }

    if (action === 'add_subject') {
      const name = textValue(body.name).trim();
      const code = textValue(body.code).trim().toUpperCase();
      if (name.length < 2 || code.length < 2) return json({ error: 'Enter a subject name and code.' }, { status: 400 });
      const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
      await db.prepare(`INSERT INTO subjects (id, course_id, name, code, color, lectures, viewed, next_topic, initials) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`).bind(crypto.randomUUID(), campusCourseId, name, code, 'teal', 'New subject', initials).run();
      return json({ ok: true });
    }

    return json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Campus POST failed', error);
    return json({ error: 'We could not save that change. Please try again.' }, { status: 500 });
  }
}
