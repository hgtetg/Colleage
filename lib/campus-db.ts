import { env } from 'cloudflare:workers';
import { readCookie, sha256 } from '@/lib/auth';

export const campusCourseId = 'software-engineering-y2-a';

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  role: 'student' | 'representative' | 'admin';
  university: string;
  college: string;
  stage: string;
  field: string;
  bio: string;
  avatarUrl: string | null;
};

export type CampusState = {
  viewer: Viewer | null;
  course: {
    id: string;
    name: string;
    yearLabel: string;
    sectionLabel: string;
    institution: string;
    college: string;
    description: string;
  };
  joinCode: {
    code: string;
    status: 'active' | 'paused' | 'invalid';
    uses: number;
  };
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    lectures: number;
    viewed: number;
    next: string;
    icon: string;
  }>;
  lectures: Array<{
    id: string;
    subjectId: string;
    title: string;
    summary: string;
    position: number;
    completed: boolean;
    design: string;
    content: {
      title?: string;
      subtitle?: string;
      sections?: Array<{
        title: string;
        body: string;
        image: number;
        keyPoint?: string;
      }>;
    } | null;
  }>;
  materials: Array<{
    id: string;
    subjectId: string;
    title: string;
    type: string;
    url: string | null;
    size: number;
  }>;
  schedule: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    title: string;
    location: string;
    tone: string;
    type: string;
    notes: string;
  }>;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    capacity: number;
    availability: string;
    tone: string;
    booked: boolean;
    meetingUrl: string | null;
  }>;
  posts: Array<{
    id: string;
    author: string;
    role: string;
    initials: string;
    time: string;
    text: string;
    pinned: boolean;
    helpful: number;
    replies: number;
    reacted: boolean;
  }>;
  members: Array<{
    initials: string;
    name: string;
    role: string;
    attendance: string;
    lastActive: string;
  }>;
  opportunities: Array<{
    id: string;
    kind: 'work' | 'scholarship' | 'volunteer';
    title: string;
    organization: string;
    description: string;
    location: string;
    deadline: string;
    status: string;
  }>;
  applications: Array<{
    id: string;
    opportunityId: string;
    title: string;
    kind: string;
    status: string;
    createdAt: string;
  }>;
  settings: {
    announcements: boolean;
    reminders: boolean;
    productUpdates: boolean;
    language: string;
    theme: string;
    profileVisibility: string;
  };
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    target: string | null;
    read: boolean;
    createdAt: string;
  }>;
  donationConfigured: boolean;
};

export type CampusEnv = {
  DB: D1Database;
  FILES: R2Bucket;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  APP_URL?: string;
};

export function getEnv() {
  return env as unknown as CampusEnv;
}
export function getDb() {
  return getEnv().DB;
}

function parseLectureContent(value: unknown): CampusState['lectures'][number]['content'] {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object'
      ? (parsed as CampusState['lectures'][number]['content'])
      : null;
  } catch {
    return null;
  }
}

export async function getViewer(
  request: Request,
  db = getDb(),
): Promise<Viewer | null> {
  const token = readCookie(request, 'campus_session');
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id,u.email,u.full_name,u.initials,u.university,u.college,u.stage,u.field,u.bio,u.avatar_key,m.role FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN memberships m ON m.user_id=u.id AND m.course_id=? WHERE s.token_hash=? AND s.expires_at>? AND u.status='active'`,
    )
    .bind(campusCourseId, await sha256(token), new Date().toISOString())
    .first<{
      id: string;
      email: string;
      full_name: string;
      initials: string;
      university: string;
      college: string;
      stage: string;
      field: string;
      bio: string;
      avatar_key: string | null;
      role: 'student' | 'representative' | 'admin' | null;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    initials: row.initials,
    role: row.role ?? 'student',
    university: row.university,
    college: row.college,
    stage: row.stage,
    field: row.field,
    bio: row.bio,
    avatarUrl: row.avatar_key
      ? `/api/files?key=${encodeURIComponent(row.avatar_key)}`
      : null,
  };
}

export async function requireViewer(request: Request, db = getDb()) {
  const viewer = await getViewer(request, db);
  if (!viewer)
    throw new Response(JSON.stringify({ error: 'Sign in to continue.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  return viewer;
}

export async function readCampusState(
  request: Request,
  db = getDb(),
): Promise<CampusState> {
  const viewer = await getViewer(request, db);
  const viewerId = viewer?.id ?? '';
  const [
    course,
    joinCode,
    subjects,
    schedule,
    rooms,
    posts,
    members,
    lectures,
    materials,
    opportunities,
    applications,
    settings,
    notifications,
  ] = await Promise.all([
    db
      .prepare(`SELECT * FROM courses WHERE id=?`)
      .bind(campusCourseId)
      .first<Record<string, string>>(),
    db
      .prepare(
        `SELECT code,status,use_count FROM join_codes WHERE course_id=? AND role='student' ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(campusCourseId)
      .first<{
        code: string;
        status: 'active' | 'paused' | 'invalid';
        use_count: number;
      }>(),
    db
      .prepare(
        `SELECT s.id,s.name,s.code,s.color,s.next_topic,s.initials,COUNT(DISTINCT l.id) lectures,COUNT(DISTINCT p.lecture_id) viewed FROM subjects s LEFT JOIN lectures l ON l.subject_id=s.id AND l.published=1 LEFT JOIN lecture_progress p ON p.lecture_id=l.id AND p.user_id=? WHERE s.course_id=? GROUP BY s.id ORDER BY s.created_at`,
      )
      .bind(viewerId, campusCourseId)
      .all<Record<string, string | number>>(),
    db
      .prepare(
        `SELECT id,starts_at,ends_at,title,location,tone,entry_type,notes FROM schedule_entries WHERE course_id=? ORDER BY starts_at`,
      )
      .bind(campusCourseId)
      .all<Record<string, string>>(),
    db
      .prepare(
        `SELECT r.*,CASE WHEN b.id IS NULL THEN 0 ELSE 1 END booked FROM rooms r LEFT JOIN bookings b ON b.room_id=r.id AND b.user_id=? AND b.status='confirmed' ORDER BY r.name`,
      )
      .bind(viewerId)
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        `SELECT p.id,p.body,p.pinned,p.created_at,u.full_name,u.initials,COALESCE(m.role,'student') role,COUNT(DISTINCT pr.user_id) helpful,COUNT(DISTINCT rr.id) replies,MAX(CASE WHEN pr.user_id=? THEN 1 ELSE 0 END) reacted FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN memberships m ON m.user_id=u.id AND m.course_id=p.course_id LEFT JOIN post_reactions pr ON pr.post_id=p.id LEFT JOIN post_replies rr ON rr.post_id=p.id WHERE p.course_id=? GROUP BY p.id ORDER BY p.pinned DESC,p.created_at DESC LIMIT 50`,
      )
      .bind(viewerId, campusCourseId)
      .all<Record<string, string | number>>(),
    db
      .prepare(
        `SELECT u.initials,u.full_name,m.role,m.attendance,m.joined_at FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.course_id=? ORDER BY CASE m.role WHEN 'representative' THEN 0 ELSE 1 END,m.joined_at LIMIT 200`,
      )
      .bind(campusCourseId)
      .all<Record<string, string | number>>(),
    db
      .prepare(
        `SELECT l.id,l.subject_id,l.title,l.summary,l.position,l.design,l.content_json,CASE WHEN p.lecture_id IS NULL THEN 0 ELSE 1 END completed FROM lectures l JOIN subjects s ON s.id=l.subject_id LEFT JOIN lecture_progress p ON p.lecture_id=l.id AND p.user_id=? WHERE s.course_id=? AND l.published=1 ORDER BY l.subject_id,l.position`,
      )
      .bind(viewerId, campusCourseId)
      .all<Record<string, string | number>>(),
    db
      .prepare(
        `SELECT m.id,m.subject_id,m.title,m.material_type,m.url,m.object_key,m.size_bytes FROM materials m JOIN subjects s ON s.id=m.subject_id WHERE s.course_id=? ORDER BY m.created_at DESC`,
      )
      .bind(campusCourseId)
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        `SELECT * FROM opportunities WHERE status='open' ORDER BY deadline`,
      )
      .all<Record<string, string>>(),
    viewer
      ? db
          .prepare(
            `SELECT a.id,a.opportunity_id,a.status,a.created_at,o.title,o.kind FROM applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.user_id=? ORDER BY a.created_at DESC`,
          )
          .bind(viewer.id)
          .all<Record<string, string>>()
      : Promise.resolve({ results: [] }),
    viewer
      ? db
          .prepare(`SELECT * FROM user_settings WHERE user_id=?`)
          .bind(viewer.id)
          .first<Record<string, string | number>>()
      : Promise.resolve(null),
    viewer
      ? db
          .prepare(
            `SELECT id,title,body,target,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20`,
          )
          .bind(viewer.id)
          .all<Record<string, string | null>>()
      : Promise.resolve({ results: [] }),
  ]);
  if (!course || !joinCode)
    throw new Error('Campus Hub has not been initialized.');
  return {
    viewer,
    course: {
      id: course.id,
      name: course.name,
      yearLabel: course.year_label,
      sectionLabel: course.section_label,
      institution: course.institution,
      college: course.college,
      description: course.description,
    },
    joinCode: {
      code: joinCode.code,
      status: joinCode.status,
      uses: joinCode.use_count,
    },
    subjects: subjects.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      code: String(r.code),
      color: String(r.color),
      lectures: Number(r.lectures),
      viewed: Number(r.viewed),
      next: String(r.next_topic),
      icon: String(r.initials),
    })),
    lectures: lectures.results.map((r) => ({
      id: String(r.id),
      subjectId: String(r.subject_id),
      title: String(r.title),
      summary: String(r.summary),
      position: Number(r.position),
      completed: Boolean(r.completed),
      design: String(r.design ?? 'atelier'),
      content: parseLectureContent(r.content_json),
    })),
    materials: materials.results.map((r) => ({
      id: String(r.id),
      subjectId: String(r.subject_id),
      title: String(r.title),
      type: String(r.material_type),
      url: r.object_key
        ? `/api/files?key=${encodeURIComponent(String(r.object_key))}`
        : r.url
          ? String(r.url)
          : null,
      size: Number(r.size_bytes ?? 0),
    })),
    schedule: schedule.results.map((r) => ({
      id: r.id,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      title: r.title,
      location: r.location,
      tone: r.tone,
      type: r.entry_type,
      notes: r.notes,
    })),
    rooms: rooms.results.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      type: String(r.room_type),
      capacity: Number(r.capacity),
      availability: String(r.availability),
      tone: String(r.tone),
      booked: Boolean(r.booked),
      meetingUrl: r.meeting_url ? String(r.meeting_url) : null,
    })),
    posts: posts.results.map((r) => ({
      id: String(r.id),
      author: String(r.full_name),
      role: String(r.role) === 'representative' ? 'Representative' : 'Student',
      initials: String(r.initials),
      time: formatRelative(String(r.created_at)),
      text: String(r.body),
      pinned: Boolean(r.pinned),
      helpful: Number(r.helpful),
      replies: Number(r.replies),
      reacted: Boolean(r.reacted),
    })),
    members: members.results.map((r, index) => ({
      initials: String(r.initials),
      name: String(r.full_name),
      role: String(r.role) === 'representative' ? 'Representative' : 'Student',
      attendance: `${Number(r.attendance)}%`,
      lastActive:
        index === 0 ? 'Active now' : formatRelative(String(r.joined_at)),
    })),
    opportunities: opportunities.results.map((r) => ({
      id: r.id,
      kind: r.kind as 'work' | 'scholarship' | 'volunteer',
      title: r.title,
      organization: r.organization,
      description: r.description,
      location: r.location,
      deadline: r.deadline,
      status: r.status,
    })),
    applications: applications.results.map((r) => ({
      id: r.id,
      opportunityId: r.opportunity_id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      createdAt: r.created_at,
    })),
    settings: {
      announcements: Boolean(settings?.announcements ?? 1),
      reminders: Boolean(settings?.reminders ?? 1),
      productUpdates: Boolean(settings?.product_updates ?? 0),
      language: String(settings?.language ?? 'en'),
      theme: String(settings?.theme ?? 'system'),
      profileVisibility: String(settings?.profile_visibility ?? 'course'),
    },
    notifications: notifications.results.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      body: String(r.body),
      target: r.target,
      read: Boolean(r.read_at),
      createdAt: String(r.created_at),
    })),
    donationConfigured: Boolean(getEnv().STRIPE_SECRET_KEY),
  };
}

function formatRelative(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 90_000) return 'Just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
  });
}
