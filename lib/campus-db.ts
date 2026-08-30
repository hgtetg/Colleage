import { env } from 'cloudflare:workers';
import { schemaStatements } from '@/db/schema';

const COURSE_ID = 'software-engineering-y2-a';
let databaseReady: Promise<void> | undefined;

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  role: 'student' | 'representative';
};

export type CampusState = {
  viewer: Viewer | null;
  course: { id: string; name: string; yearLabel: string; sectionLabel: string; institution: string };
  joinCode: { code: string; status: 'active' | 'paused' | 'invalid' };
  subjects: Array<{ id: string; name: string; code: string; color: string; lectures: number; viewed: number; next: string; icon: string }>;
  schedule: Array<{ id: string; startsAt: string; title: string; location: string; tone: string; type: string }>;
  rooms: Array<{ id: string; name: string; type: string; capacity: number; availability: string; tone: string; booked: boolean }>;
  posts: Array<{ id: string; author: string; role: string; initials: string; time: string; text: string; pinned: boolean; helpful: number; replies: number }>;
  members: Array<{ initials: string; name: string; role: string; attendance: string; lastActive: string }>;
};

export function getDb(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

export async function ensureDatabase(db = getDb()) {
  if (!databaseReady) {
    databaseReady = (async () => {
      await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
      const seeds = [
        db.prepare(`INSERT OR IGNORE INTO courses (id, name, year_label, section_label, institution) VALUES (?, ?, ?, ?, ?)`).bind(COURSE_ID, 'Software Engineering', 'Year 2', 'Section A', 'Baghdad Technical University'),
        db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?)`).bind('user-layla', 'layla@campushub.example', 'Layla Mansour', 'LM'),
        db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?)`).bind('user-sami', 'sami@campushub.example', 'Sami Kader', 'SK'),
        db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?)`).bind('user-amir', 'amir@campushub.example', 'Amir Ziad', 'AZ'),
        db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?)`).bind('user-rana', 'rana@campushub.example', 'Rana Haddad', 'RH'),
        db.prepare(`INSERT OR IGNORE INTO users (id, email, full_name, initials) VALUES (?, ?, ?, ?)`).bind('user-noor', 'noor@campushub.example', 'Noor Saleh', 'NS'),
        db.prepare(`INSERT OR IGNORE INTO memberships (user_id, course_id, role) VALUES (?, ?, ?)`).bind('user-layla', COURSE_ID, 'representative'),
        db.prepare(`INSERT OR IGNORE INTO memberships (user_id, course_id, role) VALUES (?, ?, ?)`).bind('user-sami', COURSE_ID, 'student'),
        db.prepare(`INSERT OR IGNORE INTO memberships (user_id, course_id, role) VALUES (?, ?, ?)`).bind('user-amir', COURSE_ID, 'student'),
        db.prepare(`INSERT OR IGNORE INTO memberships (user_id, course_id, role) VALUES (?, ?, ?)`).bind('user-rana', COURSE_ID, 'student'),
        db.prepare(`INSERT OR IGNORE INTO memberships (user_id, course_id, role) VALUES (?, ?, ?)`).bind('user-noor', COURSE_ID, 'student'),
        db.prepare(`INSERT OR IGNORE INTO join_codes (id, course_id, code, role, status) VALUES (?, ?, ?, ?, ?)`).bind('code-student', COURSE_ID, 'DSA2-K7Q1', 'student', 'active'),
        db.prepare(`INSERT OR IGNORE INTO join_codes (id, course_id, code, role, status) VALUES (?, ?, ?, ?, ?)`).bind('code-representative', COURSE_ID, 'REP-SE2-4MK', 'representative', 'active'),
        db.prepare(`INSERT OR IGNORE INTO subjects (id, course_id, name, code, color, lectures, viewed, next_topic, initials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind('subject-dsa', COURSE_ID, 'Data Structures', 'CSE 221', 'teal', 8, 7, 'Trees & traversals', 'DS'),
        db.prepare(`INSERT OR IGNORE INTO subjects (id, course_id, name, code, color, lectures, viewed, next_topic, initials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind('subject-dm', COURSE_ID, 'Discrete Mathematics', 'MTH 204', 'amber', 6, 5, 'Graph theory', 'DM'),
        db.prepare(`INSERT OR IGNORE INTO subjects (id, course_id, name, code, color, lectures, viewed, next_topic, initials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind('subject-os', COURSE_ID, 'Operating Systems', 'CSE 231', 'brick', 5, 2, 'Process scheduling', 'OS'),
        db.prepare(`INSERT OR IGNORE INTO subjects (id, course_id, name, code, color, lectures, viewed, next_topic, initials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind('subject-tw', COURSE_ID, 'Technical Writing', 'ENG 207', 'navy', 4, 4, 'Research abstracts', 'TW'),
        db.prepare(`INSERT OR IGNORE INTO schedule_entries (id, course_id, starts_at, title, location, tone, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('schedule-dm', COURSE_ID, '2026-08-30T09:00:00+03:00', 'Discrete Math', 'Hall 3', 'teal', 'class'),
        db.prepare(`INSERT OR IGNORE INTO schedule_entries (id, course_id, starts_at, title, location, tone, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('schedule-os', COURSE_ID, '2026-08-31T11:00:00+03:00', 'Operating Systems', 'Lab 2', 'amber', 'class'),
        db.prepare(`INSERT OR IGNORE INTO schedule_entries (id, course_id, starts_at, title, location, tone, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('schedule-dsa', COURSE_ID, '2026-09-01T10:00:00+03:00', 'DSA recitation', 'Room B12', 'teal', 'class'),
        db.prepare(`INSERT OR IGNORE INTO schedule_entries (id, course_id, starts_at, title, location, tone, entry_type) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind('schedule-study', COURSE_ID, '2026-09-02T14:00:00+03:00', 'Open study block', 'Library', 'plain', 'study'),
        db.prepare(`INSERT OR IGNORE INTO rooms (id, name, room_type, capacity, availability, tone) VALUES (?, ?, ?, ?, ?, ?)`).bind('room-b12', 'Study Room B12', 'Physical room', 6, 'Available until 16:00', 'available'),
        db.prepare(`INSERT OR IGNORE INTO rooms (id, name, room_type, capacity, availability, tone) VALUES (?, ?, ?, ?, ?, ?)`).bind('room-pod-3', 'Library Pod 3', 'Physical room', 4, 'Available at 14:30', 'soon'),
        db.prepare(`INSERT OR IGNORE INTO rooms (id, name, room_type, capacity, availability, tone) VALUES (?, ?, ?, ?, ?, ?)`).bind('room-team-a', 'Team A Virtual Room', 'Online room', 99, 'Open all day', 'available'),
        db.prepare(`INSERT OR IGNORE INTO posts (id, course_id, user_id, body, pinned, helpful_count, reply_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind('post-room-change', COURSE_ID, 'user-layla', 'Tuesday’s DSA recitation has moved to Room B12. Same time, just across the courtyard.', 1, 12, 3, '2026-08-29T08:42:00+03:00'),
        db.prepare(`INSERT OR IGNORE INTO posts (id, course_id, user_id, body, pinned, helpful_count, reply_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind('post-study-session', COURSE_ID, 'user-sami', 'Anyone up for a study session before Thursday’s quiz? I booked Library Pod 3 for 14:30.', 0, 4, 6, '2026-08-28T18:16:00+03:00'),
      ];
      await db.batch(seeds);
    })().catch((error) => {
      databaseReady = undefined;
      throw error;
    });
  }
  return databaseReady;
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get('cookie') ?? '';
  for (const item of cookies.split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return decodeURIComponent(parts.join('='));
  }
  return null;
}

export async function getViewer(request: Request, db = getDb()): Promise<Viewer | null> {
  const token = readCookie(request, 'campus_session');
  if (!token) return null;
  const row = await db.prepare(`SELECT u.id, u.email, u.full_name, u.initials, m.role FROM sessions s JOIN users u ON u.id = s.user_id JOIN memberships m ON m.user_id = u.id AND m.course_id = ? WHERE s.token = ? AND s.expires_at > ?`).bind(COURSE_ID, token, new Date().toISOString()).first<{ id: string; email: string; full_name: string; initials: string; role: 'student' | 'representative' }>();
  return row ? { id: row.id, email: row.email, fullName: row.full_name, initials: row.initials, role: row.role } : null;
}

export async function readCampusState(request: Request, db = getDb()): Promise<CampusState> {
  await ensureDatabase(db);
  const viewer = await getViewer(request, db);
  const [course, joinCode, subjectRows, scheduleRows, roomRows, postRows, memberRows] = await Promise.all([
    db.prepare(`SELECT id, name, year_label, section_label, institution FROM courses WHERE id = ?`).bind(COURSE_ID).first<{ id: string; name: string; year_label: string; section_label: string; institution: string }>(),
    db.prepare(`SELECT code, status FROM join_codes WHERE course_id = ? AND role = 'student' ORDER BY created_at DESC LIMIT 1`).bind(COURSE_ID).first<{ code: string; status: 'active' | 'paused' | 'invalid' }>(),
    db.prepare(`SELECT id, name, code, color, lectures, viewed, next_topic, initials FROM subjects WHERE course_id = ? ORDER BY created_at`).bind(COURSE_ID).all<{ id: string; name: string; code: string; color: string; lectures: number; viewed: number; next_topic: string; initials: string }>(),
    db.prepare(`SELECT id, starts_at, title, location, tone, entry_type FROM schedule_entries WHERE course_id = ? ORDER BY starts_at`).bind(COURSE_ID).all<{ id: string; starts_at: string; title: string; location: string; tone: string; entry_type: string }>(),
    db.prepare(`SELECT r.id, r.name, r.room_type, r.capacity, r.availability, r.tone, CASE WHEN b.id IS NULL THEN 0 ELSE 1 END AS booked FROM rooms r LEFT JOIN bookings b ON b.room_id = r.id AND b.user_id = ? ORDER BY r.id`).bind(viewer?.id ?? '').all<{ id: string; name: string; room_type: string; capacity: number; availability: string; tone: string; booked: number }>(),
    db.prepare(`SELECT p.id, p.body, p.pinned, p.helpful_count, p.reply_count, p.created_at, u.full_name, u.initials, m.role FROM posts p JOIN users u ON u.id = p.user_id JOIN memberships m ON m.user_id = u.id AND m.course_id = p.course_id WHERE p.course_id = ? ORDER BY p.pinned DESC, p.created_at DESC LIMIT 50`).bind(COURSE_ID).all<{ id: string; body: string; pinned: number; helpful_count: number; reply_count: number; created_at: string; full_name: string; initials: string; role: string }>(),
    db.prepare(`SELECT u.initials, u.full_name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.course_id = ? ORDER BY CASE m.role WHEN 'representative' THEN 0 ELSE 1 END, m.joined_at LIMIT 50`).bind(COURSE_ID).all<{ initials: string; full_name: string; role: string }>(),
  ]);

  if (!course || !joinCode) throw new Error('Campus Hub seed data is unavailable.');
  return {
    viewer,
    course: { id: course.id, name: course.name, yearLabel: course.year_label, sectionLabel: course.section_label, institution: course.institution },
    joinCode,
    subjects: subjectRows.results.map((row) => ({ id: row.id, name: row.name, code: row.code, color: row.color, lectures: row.lectures, viewed: row.viewed, next: row.next_topic, icon: row.initials })),
    schedule: scheduleRows.results.map((row) => ({ id: row.id, startsAt: row.starts_at, title: row.title, location: row.location, tone: row.tone, type: row.entry_type })),
    rooms: roomRows.results.map((row) => ({ id: row.id, name: row.name, type: row.room_type, capacity: row.capacity, availability: row.availability, tone: row.tone, booked: Boolean(row.booked) })),
    posts: postRows.results.map((row) => ({ id: row.id, author: row.full_name, role: row.role === 'representative' ? 'Representative' : 'Student', initials: row.initials, time: formatRelative(row.created_at), text: row.body, pinned: Boolean(row.pinned), helpful: row.helpful_count, replies: row.reply_count })),
    members: memberRows.results.map((row, index) => ({ initials: row.initials, name: row.full_name, role: row.role === 'representative' ? 'Representative' : 'Student', attendance: `${[96, 91, 87, 94, 89][index % 5]}%`, lastActive: index === 0 ? 'Active now' : `${index * 12}m ago` })),
  };
}

function formatRelative(value: string) {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  if (delta < 90_000) return 'Just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

export const campusCourseId = COURSE_ID;

