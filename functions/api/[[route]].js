const COOKIE_NAME = 'colleage_session';
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 120000;

export async function onRequest(context) {
  const { request, env, params } = context;
  if (!env.DB) return json({ error: 'D1 binding DB is not configured.' }, 503);

  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) assertSameOrigin(request);

    const route = normalizeRoute(params.route);
    const method = request.method.toUpperCase();

    if (method === 'GET' && route.length === 1 && route[0] === 'health') {
      await env.DB.prepare('SELECT 1').first();
      return json({ ok: true, service: 'colleage-api' });
    }

    if (route[0] === 'auth') return handleAuth(context, route.slice(1));

    const user = await requireUser(request, env.DB);

    if (route[0] === 'profile') return handleProfile(context, user);
    if (route[0] === 'courses') return handleCourses(context, user, route.slice(1));
    if (route[0] === 'subjects') return handleSubjects(context, user, route.slice(1));
    if (route[0] === 'schedule') return handleSchedule(context, user, route.slice(1));
    if (route[0] === 'rooms') return handleRooms(context, user, route.slice(1));
    if (route[0] === 'posts') return handlePosts(context, user, route.slice(1));
    if (route[0] === 'dashboard') return handleDashboard(context, user);

    return json({ error: 'API route not found.' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Colleage API error', error);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}

async function handleAuth({ request, env }, route) {
  const method = request.method.toUpperCase();

  if (method === 'POST' && route[0] === 'signup') {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.fullName || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'manager' ? 'manager' : 'student';

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (fullName.length < 2) throw new HttpError(400, 'Enter your full name.');
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

    if (role === 'manager') {
      if (!env.MANAGER_INVITE_CODE) throw new HttpError(403, 'Manager signup is not enabled yet.');
      if (String(body.managerCode || '') !== String(env.MANAGER_INVITE_CODE)) throw new HttpError(403, 'Invalid manager invite code.');
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) throw new HttpError(409, 'An account with this email already exists.');

    const id = crypto.randomUUID();
    const { hash, salt } = await hashPassword(password);
    const stage = cleanOptional(body.stage);
    const field = cleanOptional(body.field);
    const institutionType = ['school', 'university'].includes(body.institutionType) ? body.institutionType : null;
    const institutionName = cleanOptional(body.institutionName);

    await env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, password_salt, full_name, role, stage, field, institution_type, institution_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, email, hash, salt, fullName, role, stage, field, institutionType, institutionName).run();

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
    return json({ user: await publicUser(env.DB, id) }, 201, { 'Set-Cookie': sessionCookie(session.token, request) });
  }

  if (method === 'POST' && route[0] === 'login') {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    const session = await createSession(env.DB, user.id);
    return json({ user: await publicUser(env.DB, user.id) }, 200, { 'Set-Cookie': sessionCookie(session.token, request) });
  }

  if (method === 'POST' && route[0] === 'logout') {
    const token = readCookie(request, COOKIE_NAME);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
  }

  if (method === 'GET' && route[0] === 'me') {
    const user = await requireUser(request, env.DB);
    return json({ user: await publicUser(env.DB, user.id) });
  }

  return json({ error: 'Auth route not found.' }, 404);
}

async function handleProfile({ request, env }, user) {
  if (request.method === 'GET') return json({ user: await publicUser(env.DB, user.id) });
  if (request.method !== 'PATCH') return methodNotAllowed();

  const body = await readJson(request);
  const fullName = cleanOptional(body.fullName) || user.full_name;
  const photoUrl = cleanOptional(body.photoUrl);
  const stage = cleanOptional(body.stage);
  const field = cleanOptional(body.field);
  const institutionType = ['school', 'university'].includes(body.institutionType) ? body.institutionType : null;
  const institutionName = cleanOptional(body.institutionName);

  await env.DB.prepare(`
    UPDATE users
    SET full_name = ?, photo_url = ?, stage = ?, field = ?, institution_type = ?, institution_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(fullName, photoUrl, stage, field, institutionType, institutionName, user.id).run();
  return json({ user: await publicUser(env.DB, user.id) });
}

async function handleCourses({ request, env }, user, route) {
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (!route.length && method === 'GET') {
    const enrolled = await db.prepare(`
      SELECT c.*, e.position, e.is_active
      FROM enrollments e JOIN courses c ON c.id = e.course_id
      WHERE e.user_id = ? ORDER BY e.position
    `).bind(user.id).all();
    const discover = await db.prepare(`
      SELECT c.* FROM courses c
      WHERE c.is_public = 1
        AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id = ?)
      ORDER BY c.created_at DESC LIMIT 20
    `).bind(user.id).all();
    return json({ enrolled: enrolled.results || [], discover: discover.results || [] });
  }

  if (!route.length && method === 'POST') {
    requireManager(user);
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'Course name is required.');
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO courses (id, name, stage, field, institution_type, institution_name, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, name, cleanOptional(body.stage), cleanOptional(body.field),
      ['school', 'university'].includes(body.institutionType) ? body.institutionType : null,
      cleanOptional(body.institutionName), body.isPublic ? 1 : 0, user.id
    ).run();
    return json({ id }, 201);
  }

  const courseId = route[0];
  if (courseId && route[1] === 'enroll' && method === 'POST') {
    const course = await db.prepare('SELECT * FROM courses WHERE id = ?').bind(courseId).first();
    if (!course) throw new HttpError(404, 'Course not found.');
    if (!course.is_public && !courseMatchesUser(course, user)) throw new HttpError(403, 'This course does not match your academic profile.');

    const count = await db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE user_id = ?').bind(user.id).first();
    if ((count?.n || 0) >= 3) throw new HttpError(409, 'You can enroll in up to three courses.');

    const positions = await db.prepare('SELECT position FROM enrollments WHERE user_id = ? ORDER BY position').bind(user.id).all();
    const used = new Set((positions.results || []).map(x => x.position));
    const position = [1, 2, 3].find(x => !used.has(x));
    const active = used.size === 0 ? 1 : 0;
    await db.prepare('INSERT INTO enrollments (user_id, course_id, position, is_active) VALUES (?, ?, ?, ?)')
      .bind(user.id, courseId, position, active).run();
    return json({ ok: true, position, active: !!active }, 201);
  }

  if (courseId && route[1] === 'activate' && method === 'POST') {
    const enrollment = await db.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?').bind(user.id, courseId).first();
    if (!enrollment) throw new HttpError(403, 'Enroll in this course first.');
    await db.batch([
      db.prepare('UPDATE enrollments SET is_active = 0 WHERE user_id = ?').bind(user.id),
      db.prepare('UPDATE enrollments SET is_active = 1 WHERE user_id = ? AND course_id = ?').bind(user.id, courseId)
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Course route not found.' }, 404);
}

async function handleSubjects({ request, env }, user, route) {
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (!route.length && method === 'GET') {
    const url = new URL(request.url);
    const courseId = url.searchParams.get('courseId') || await activeCourseId(db, user.id);
    if (!courseId) return json({ subjects: [] });
    const rows = await db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM lectures l WHERE l.subject_id = s.id) AS lectures,
        COALESCE((SELECT ROUND(AVG(g.score * 100.0 / g.max_score), 1) FROM grades g WHERE g.subject_id = s.id AND g.user_id = ?), 0) AS grade
      FROM subjects s WHERE s.course_id = ? ORDER BY s.name
    `).bind(user.id, courseId).all();
    return json({ courseId, subjects: rows.results || [] });
  }

  if (!route.length && method === 'POST') {
    requireManager(user);
    const body = await readJson(request);
    const courseId = cleanOptional(body.courseId) || await activeCourseId(db, user.id);
    const name = String(body.name || '').trim();
    if (!courseId || !name) throw new HttpError(400, 'courseId and subject name are required.');
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO subjects (id, course_id, name, code, icon, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, courseId, name, cleanOptional(body.code), cleanOptional(body.icon) || 'book', cleanOptional(body.description), user.id).run();
    return json({ id }, 201);
  }

  const subjectId = route[0];
  if (!subjectId) return json({ error: 'Subject route not found.' }, 404);

  if (route[1] === 'lectures') {
    if (method === 'GET') {
      const rows = await db.prepare('SELECT * FROM lectures WHERE subject_id = ? ORDER BY position, created_at').bind(subjectId).all();
      return json({ lectures: rows.results || [] });
    }
    if (method === 'POST') {
      requireManager(user);
      const body = await readJson(request);
      const title = String(body.title || '').trim();
      if (!title) throw new HttpError(400, 'Lecture title is required.');
      const id = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO lectures (id, subject_id, title, position, summary, notes_url, flashcards_url, mind_map_url, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, subjectId, title, Number(body.position) || 1, cleanOptional(body.summary), cleanOptional(body.notesUrl), cleanOptional(body.flashcardsUrl), cleanOptional(body.mindMapUrl), user.id).run();
      return json({ id }, 201);
    }
  }

  if (route[1] === 'grades') {
    if (method === 'GET') {
      const rows = await db.prepare('SELECT * FROM grades WHERE subject_id = ? AND user_id = ? ORDER BY created_at DESC').bind(subjectId, user.id).all();
      return json({ grades: rows.results || [] });
    }
    if (method === 'POST') {
      requireManager(user);
      const body = await readJson(request);
      const targetUserId = cleanOptional(body.userId) || user.id;
      const title = String(body.title || '').trim();
      const score = Number(body.score);
      const maxScore = Number(body.maxScore);
      if (!title || !Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) throw new HttpError(400, 'Valid grade fields are required.');
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO grades (id, user_id, subject_id, title, score, max_score, weight) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, targetUserId, subjectId, title, score, maxScore, Number(body.weight) || 1).run();
      return json({ id }, 201);
    }
  }

  if (method === 'PATCH') {
    requireManager(user);
    const body = await readJson(request);
    const current = await db.prepare('SELECT * FROM subjects WHERE id = ?').bind(subjectId).first();
    if (!current) throw new HttpError(404, 'Subject not found.');
    await db.prepare(`
      UPDATE subjects SET name = ?, code = ?, icon = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(
      cleanOptional(body.name) || current.name,
      body.code === undefined ? current.code : cleanOptional(body.code),
      cleanOptional(body.icon) || current.icon,
      body.description === undefined ? current.description : cleanOptional(body.description),
      subjectId
    ).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    requireManager(user);
    await db.prepare('DELETE FROM subjects WHERE id = ?').bind(subjectId).run();
    return json({ ok: true });
  }

  return json({ error: 'Subject route not found.' }, 404);
}

async function handleSchedule({ request, env }, user, route) {
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (!route.length && method === 'GET') {
    const rows = await db.prepare(`
      SELECT * FROM schedule_items WHERE user_id = ? ORDER BY start_at ASC LIMIT 100
    `).bind(user.id).all();
    return json({ items: rows.results || [] });
  }

  if (!route.length && method === 'POST') {
    const body = await readJson(request);
    const title = String(body.title || '').trim();
    const startAt = String(body.startAt || '').trim();
    if (!title || !startAt) throw new HttpError(400, 'Title and startAt are required.');
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO schedule_items (id, user_id, course_id, subject_id, title, start_at, end_at, type, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, user.id, cleanOptional(body.courseId) || await activeCourseId(db, user.id), cleanOptional(body.subjectId), title, startAt, cleanOptional(body.endAt), cleanOptional(body.type) || 'Study', cleanOptional(body.location)).run();
    return json({ id }, 201);
  }

  const id = route[0];
  if (id && method === 'PATCH') {
    const current = await db.prepare('SELECT * FROM schedule_items WHERE id = ? AND user_id = ?').bind(id, user.id).first();
    if (!current) throw new HttpError(404, 'Schedule item not found.');
    const body = await readJson(request);
    await db.prepare(`
      UPDATE schedule_items SET title = ?, start_at = ?, end_at = ?, type = ?, location = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).bind(
      cleanOptional(body.title) || current.title,
      cleanOptional(body.startAt) || current.start_at,
      body.endAt === undefined ? current.end_at : cleanOptional(body.endAt),
      cleanOptional(body.type) || current.type,
      body.location === undefined ? current.location : cleanOptional(body.location),
      body.completed === undefined ? current.completed : (body.completed ? 1 : 0),
      id, user.id
    ).run();
    return json({ ok: true });
  }

  if (id && method === 'DELETE') {
    await db.prepare('DELETE FROM schedule_items WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Schedule route not found.' }, 404);
}

async function handleRooms({ request, env }, user, route) {
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (!route.length && method === 'GET') {
    const courseId = new URL(request.url).searchParams.get('courseId') || await activeCourseId(db, user.id);
    if (!courseId) return json({ rooms: [] });
    const rows = await db.prepare(`
      SELECT r.*, u.full_name AS creator_name,
        (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count,
        EXISTS(SELECT 1 FROM room_members rm WHERE rm.room_id = r.id AND rm.user_id = ?) AS joined
      FROM study_rooms r JOIN users u ON u.id = r.created_by
      WHERE r.course_id = ? ORDER BY r.is_live DESC, r.created_at DESC LIMIT 50
    `).bind(user.id, courseId).all();
    return json({ courseId, rooms: rows.results || [] });
  }

  if (!route.length && method === 'POST') {
    const body = await readJson(request);
    const name = String(body.name || '').trim();
    if (!name) throw new HttpError(400, 'Room name is required.');
    const courseId = cleanOptional(body.courseId) || await activeCourseId(db, user.id);
    if (!courseId) throw new HttpError(400, 'Choose an active course first.');
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare('INSERT INTO study_rooms (id, course_id, subject_id, name, topic, created_by, is_live) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, courseId, cleanOptional(body.subjectId), name, cleanOptional(body.topic), user.id, body.isLive === false ? 0 : 1),
      db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').bind(id, user.id)
    ]);
    return json({ id }, 201);
  }

  const id = route[0];
  if (id && route[1] === 'join' && method === 'POST') {
    const exists = await db.prepare('SELECT id FROM study_rooms WHERE id = ?').bind(id).first();
    if (!exists) throw new HttpError(404, 'Room not found.');
    await db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)').bind(id, user.id).run();
    return json({ ok: true });
  }
  if (id && route[1] === 'join' && method === 'DELETE') {
    await db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').bind(id, user.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Room route not found.' }, 404);
}

async function handlePosts({ request, env }, user, route) {
  const db = env.DB;
  const method = request.method.toUpperCase();

  if (!route.length && method === 'GET') {
    const courseId = new URL(request.url).searchParams.get('courseId') || await activeCourseId(db, user.id);
    if (!courseId) return json({ posts: [] });
    const rows = await db.prepare(`
      SELECT p.*, u.full_name,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.course_id = ? ORDER BY p.created_at DESC LIMIT 100
    `).bind(courseId).all();
    return json({ courseId, posts: rows.results || [] });
  }

  if (!route.length && method === 'POST') {
    const body = await readJson(request);
    const text = String(body.body || '').trim();
    if (!text) throw new HttpError(400, 'Post cannot be empty.');
    const courseId = cleanOptional(body.courseId) || await activeCourseId(db, user.id);
    if (!courseId) throw new HttpError(400, 'Choose an active course first.');
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO posts (id, course_id, subject_id, user_id, body) VALUES (?, ?, ?, ?, ?)')
      .bind(id, courseId, cleanOptional(body.subjectId), user.id, text).run();
    return json({ id }, 201);
  }

  const id = route[0];
  if (id && route[1] === 'comments') {
    if (method === 'GET') {
      const rows = await db.prepare(`
        SELECT c.*, u.full_name FROM comments c JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ? ORDER BY c.created_at
      `).bind(id).all();
      return json({ comments: rows.results || [] });
    }
    if (method === 'POST') {
      const body = await readJson(request);
      const text = String(body.body || '').trim();
      if (!text) throw new HttpError(400, 'Comment cannot be empty.');
      const commentId = crypto.randomUUID();
      await db.prepare('INSERT INTO comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)').bind(commentId, id, user.id, text).run();
      return json({ id: commentId }, 201);
    }
  }

  if (id && method === 'DELETE') {
    const post = await db.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).first();
    if (!post) throw new HttpError(404, 'Post not found.');
    if (post.user_id !== user.id && user.role !== 'manager') throw new HttpError(403, 'You cannot delete this post.');
    await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Post route not found.' }, 404);
}

async function handleDashboard({ env }, user) {
  const db = env.DB;
  const courseId = await activeCourseId(db, user.id);
  const subjects = courseId ? await db.prepare(`
    SELECT COUNT(*) AS count FROM subjects WHERE course_id = ?
  `).bind(courseId).first() : { count: 0 };
  const schedule = await db.prepare(`
    SELECT COUNT(*) AS count FROM schedule_items WHERE user_id = ? AND completed = 0
  `).bind(user.id).first();
  const rooms = courseId ? await db.prepare(`
    SELECT COUNT(*) AS count FROM study_rooms WHERE course_id = ? AND is_live = 1
  `).bind(courseId).first() : { count: 0 };
  const posts = courseId ? await db.prepare(`
    SELECT COUNT(*) AS count FROM posts WHERE course_id = ?
  `).bind(courseId).first() : { count: 0 };
  return json({ courseId, counts: { subjects: subjects?.count || 0, schedule: schedule?.count || 0, liveRooms: rooms?.count || 0, posts: posts?.count || 0 } });
}

async function publicUser(db, id) {
  return db.prepare(`
    SELECT id, email, full_name AS fullName, photo_url AS photoUrl, role, stage, field,
           institution_type AS institutionType, institution_name AS institutionName, created_at AS createdAt
    FROM users WHERE id = ?
  `).bind(id).first();
}

async function requireUser(request, db) {
  const token = readCookie(request, COOKIE_NAME);
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  const tokenHash = await sha256Hex(token);
  const user = await db.prepare(`
    SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  if (!user) throw new HttpError(401, 'Your session has expired.');
  return user;
}

function requireManager(user) {
  if (user.role !== 'manager') throw new HttpError(403, 'Manager permission required.');
}

async function activeCourseId(db, userId) {
  const row = await db.prepare('SELECT course_id FROM enrollments WHERE user_id = ? AND is_active = 1 LIMIT 1').bind(userId).first();
  if (row?.course_id) return row.course_id;
  const fallback = await db.prepare('SELECT course_id FROM enrollments WHERE user_id = ? ORDER BY position LIMIT 1').bind(userId).first();
  return fallback?.course_id || null;
}

function courseMatchesUser(course, user) {
  return same(course.stage, user.stage) && same(course.field, user.field) &&
    course.institution_type === user.institution_type && same(course.institution_name, user.institution_name);
}

function same(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, userId, expiresAt).run();
  await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()).run();
  return { token, expiresAt };
}

async function hashPassword(password, saltHex) {
  const salt = saltHex || bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt };
}

async function verifyPassword(password, salt, expectedHash) {
  const { hash } = await hashPassword(password, salt);
  return constantTimeEqual(hash, expectedHash);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
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
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function normalizeRoute(route) {
  if (!route) return [];
  if (Array.isArray(route)) return route.filter(Boolean);
  return String(route).split('/').filter(Boolean);
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new HttpError(415, 'Send JSON with Content-Type: application/json.');
  try { return await request.json(); } catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new HttpError(403, 'Cross-origin write blocked.');
}

function cleanOptional(value) {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out || null;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}

function methodNotAllowed() { return json({ error: 'Method not allowed.' }, 405); }

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
