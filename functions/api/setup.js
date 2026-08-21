const REQUIRED_TABLES = [
  'users', 'sessions', 'courses', 'enrollments', 'subjects', 'lectures',
  'grades', 'schedule_items', 'study_rooms', 'room_members', 'posts', 'comments'
];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'manager')),
  stage TEXT,
  field TEXT,
  institution_type TEXT CHECK (institution_type IN ('school', 'university') OR institution_type IS NULL),
  institution_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stage TEXT,
  field TEXT,
  institution_type TEXT CHECK (institution_type IN ('school', 'university') OR institution_type IS NULL),
  institution_name TEXT,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_courses_match ON courses(stage, field, institution_type, institution_name);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 3),
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  enrolled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, course_id),
  UNIQUE (user_id, position)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON enrollments(user_id, is_active);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  icon TEXT NOT NULL DEFAULT 'book',
  description TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subjects_course ON subjects(course_id);

CREATE TABLE IF NOT EXISTS lectures (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  notes_url TEXT,
  flashcards_url TEXT,
  mind_map_url TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lectures_subject ON lectures(subject_id, position);

CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  score REAL NOT NULL,
  max_score REAL NOT NULL CHECK (max_score > 0),
  weight REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_grades_user_subject ON grades(user_id, subject_id);

CREATE TABLE IF NOT EXISTS schedule_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  type TEXT NOT NULL DEFAULT 'Study',
  location TEXT,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_schedule_user_start ON schedule_items(user_id, start_at);

CREATE TABLE IF NOT EXISTS study_rooms (
  id TEXT PRIMARY KEY,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  topic TEXT,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_live INTEGER NOT NULL DEFAULT 1 CHECK (is_live IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rooms_course ON study_rooms(course_id, is_live);

CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_course_created ON posts(course_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

INSERT OR IGNORE INTO courses (id, name, is_public, field)
VALUES ('course-med-foundations', 'Medical Foundations', 1, 'Medicine');

INSERT OR IGNORE INTO subjects (id, course_id, name, code, icon, description)
VALUES
  ('anatomy', 'course-med-foundations', 'Human Anatomy', 'MED-204', 'book', 'Anatomy lectures, notes, flashcards and revision resources.'),
  ('chemistry', 'course-med-foundations', 'Organic Chemistry', 'CHEM-211', 'flask', 'Organic chemistry concepts, mechanisms and practice.'),
  ('physics', 'course-med-foundations', 'Medical Physics', 'PHY-205', 'atom', 'Physics concepts used across medical sciences.'),
  ('biology', 'course-med-foundations', 'Cell Biology', 'BIO-202', 'dna', 'Cellular structures, processes and molecular foundations.');
`;

export async function onRequestGet({ env, request }) {
  if (!env.DB) return htmlPage({ bound: false, ready: false, missing: REQUIRED_TABLES }, request, 503);

  try {
    const status = await schemaStatus(env.DB);
    return htmlPage({ bound: true, ...status }, request, 200);
  } catch (error) {
    return htmlPage({ bound: true, ready: false, missing: REQUIRED_TABLES, error: String(error?.message || error) }, request, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.DB) return json({ ok: false, error: 'D1 binding DB is not configured.' }, 503);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: 'Cross-origin setup request blocked.' }, 403);
  }

  try {
    const before = await schemaStatus(env.DB);
    if (!before.ready) {
      await env.DB.exec(SCHEMA_SQL);
    }

    const after = await schemaStatus(env.DB);
    if (!after.ready) {
      return json({ ok: false, error: 'Database setup did not finish.', missing: after.missing }, 500);
    }

    return json({
      ok: true,
      initialized: !before.ready,
      message: before.ready ? 'Database was already initialized.' : 'Colleage database initialized successfully.',
      tables: after.tables
    });
  } catch (error) {
    console.error('D1 setup failed', error);
    return json({
      ok: false,
      error: 'Database initialization failed.',
      detail: String(error?.message || error).slice(0, 500)
    }, 500);
  }
}

async function schemaStatus(db) {
  const result = await db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all();
  const tables = (result.results || []).map(row => row.name).filter(Boolean).sort();
  const names = new Set(tables);
  const missing = REQUIRED_TABLES.filter(name => !names.has(name));
  return { ready: missing.length === 0, missing, tables };
}

function htmlPage(status, request, statusCode) {
  const title = status.ready ? 'Database ready' : 'Set up Colleage database';
  const stateClass = status.ready ? 'ready' : status.bound ? 'waiting' : 'error';
  const description = status.ready
    ? 'All required Colleage tables are available. You can return to the website and create your account.'
    : status.bound
      ? 'Your D1 binding is connected, but the application tables are missing. Press the button below once to initialize them.'
      : 'The Pages Function cannot see a D1 binding named DB yet.';
  const missing = status.missing?.length ? `<div class="missing"><strong>Missing tables</strong><p>${escapeHtml(status.missing.join(', '))}</p></div>` : '';
  const error = status.error ? `<div class="error-box">${escapeHtml(status.error)}</div>` : '';
  const action = status.ready
    ? `<a class="button" href="/">Return to Colleage</a>`
    : status.bound
      ? `<button class="button" id="setupButton" type="button">Initialize database</button>`
      : `<a class="button" href="/">Return to site</a>`;

  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#17211c;background:#f4f7f5}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(620px,100%);background:#fff;border:1px solid #dfe7e2;border-radius:24px;padding:32px;box-shadow:0 24px 70px rgba(22,42,33,.09)}.badge{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800}.badge.ready{background:#e9f8ef;color:#167244}.badge.waiting{background:#fff6df;color:#8c5b00}.badge.error{background:#fdecec;color:#a42828}.dot{width:8px;height:8px;border-radius:50%;background:currentColor}h1{font-size:34px;letter-spacing:-.04em;margin:18px 0 10px}p{color:#617168;line-height:1.65}.missing,.error-box{margin:20px 0;padding:14px 16px;border-radius:14px;background:#f6f8f7;font-size:13px}.missing strong{display:block;margin-bottom:5px}.missing p{margin:0;font-size:12px}.error-box{background:#fdecec;color:#a42828}.button{display:inline-flex;justify-content:center;align-items:center;width:100%;margin-top:12px;border:0;border-radius:13px;background:#0e6b50;color:#fff;padding:13px 16px;font-weight:800;text-decoration:none;cursor:pointer}.button[disabled]{opacity:.55;cursor:wait}.result{margin-top:14px;font-size:13px;font-weight:700}.muted{font-size:12px;color:#819087;margin-top:18px}
</style></head><body><main class="card"><span class="badge ${stateClass}"><span class="dot"></span>${status.ready ? 'Ready' : status.bound ? 'Setup required' : 'Binding missing'}</span><h1>${title}</h1><p>${description}</p>${missing}${error}${action}<div class="result" id="result"></div><p class="muted">This setup only creates missing tables and starter records. It does not delete existing data.</p></main>
<script>
const button=document.getElementById('setupButton');
if(button){button.addEventListener('click',async()=>{button.disabled=true;button.textContent='Initializing…';const result=document.getElementById('result');result.textContent='';try{const response=await fetch('/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.detail||data.error||'Setup failed');result.textContent=data.message||'Database initialized.';setTimeout(()=>location.reload(),700)}catch(error){result.textContent=error.message;button.disabled=false;button.textContent='Try again'}})}
</script></body></html>`, {
    status: statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
