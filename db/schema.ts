export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    initials TEXT NOT NULL,
    university TEXT NOT NULL DEFAULT 'Baghdad Technical University',
    college TEXT NOT NULL DEFAULT 'College of Computing',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year_label TEXT NOT NULL,
    section_label TEXT NOT NULL,
    institution TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'representative')),
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS join_codes (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('student', 'representative')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'invalid')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`,
  `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    color TEXT NOT NULL,
    lectures INTEGER NOT NULL DEFAULT 0,
    viewed INTEGER NOT NULL DEFAULT 0,
    next_topic TEXT NOT NULL DEFAULT '',
    initials TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_entries (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'teal',
    entry_type TEXT NOT NULL DEFAULT 'class',
    FOREIGN KEY (course_id) REFERENCES courses(id)
  )`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    room_type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    availability TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'available'
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_memberships_course ON memberships(course_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_schedule_course_time ON schedule_entries(course_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_user_time ON bookings(user_id, starts_at)`,
  `CREATE INDEX IF NOT EXISTS idx_posts_course_time ON posts(course_id, created_at DESC)`,
] as const;

