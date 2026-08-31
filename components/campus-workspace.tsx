'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  Copy,
  CreditCard,
  DoorOpen,
  Download,
  ExternalLink,
  FileText,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  LockKeyhole,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  Pause,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { CampusState } from '@/lib/campus-db';

type SubmitLike = { preventDefault: () => void };

const navItems = [
  { key: 'dashboard', label: 'Dashboard', arabic: 'الرئيسية', icon: Home },
  { key: 'subjects', label: 'Subjects', arabic: 'المواد', icon: BookOpen },
  { key: 'schedule', label: 'Schedule', arabic: 'الجدول', icon: CalendarDays },
  { key: 'rooms', label: 'Study rooms', arabic: 'غرف الدراسة', icon: DoorOpen },
  {
    key: 'community',
    label: 'Community',
    arabic: 'المجتمع',
    icon: MessageCircle,
  },
];

const subnav: Record<string, string[]> = {
  dashboard: ['Overview', 'My progress', 'Announcements'],
  subjects: ['All subjects', 'By semester', 'Materials'],
  schedule: ['Week view', 'List view', 'Exams & deadlines'],
  rooms: ['Available now', 'Book a room', 'My bookings'],
  community: ['Feed', 'Discussions', 'Course groups'],
  manage: ['Overview', 'Members', 'Join codes', 'Analytics'],
  profile: ['Profile', 'Applications', 'Privacy'],
  settings: ['Account', 'Notifications', 'Appearance'],
  join: ['Choose your path', 'Your details', 'Course access'],
  landing: ['How it works', 'For students', 'For representatives'],
};

const fallbackScheduleDays = [
  {
    day: 'SUN',
    date: '30',
    item: 'Discrete Math',
    meta: '09:00 · Hall 3',
    tone: 'teal',
  },
  {
    day: 'MON',
    date: '31',
    item: 'Operating Systems',
    meta: '11:00 · Lab 2',
    tone: 'amber',
  },
  {
    day: 'TUE',
    date: '01',
    item: 'DSA recitation',
    meta: '10:00 · Room B12',
    tone: 'teal',
  },
  {
    day: 'WED',
    date: '02',
    item: 'Open study block',
    meta: '14:00 · Library',
    tone: 'plain',
  },
];

const fallbackSubjects = [
  {
    name: 'Data Structures',
    code: 'CSE 221',
    color: 'teal',
    lectures: 8,
    viewed: 7,
    next: 'Trees & traversals',
    icon: 'DS',
  },
  {
    name: 'Discrete Mathematics',
    code: 'MTH 204',
    color: 'amber',
    lectures: 6,
    viewed: 5,
    next: 'Graph theory',
    icon: 'DM',
  },
  {
    name: 'Operating Systems',
    code: 'CSE 231',
    color: 'brick',
    lectures: 5,
    viewed: 2,
    next: 'Process scheduling',
    icon: 'OS',
  },
  {
    name: 'Technical Writing',
    code: 'ENG 207',
    color: 'navy',
    lectures: 4,
    viewed: 4,
    next: 'Research abstracts',
    icon: 'TW',
  },
];

const fallbackRooms = [
  {
    id: 'room-b12',
    name: 'Study Room B12',
    type: 'Physical room',
    capacity: 6,
    availability: 'Available until 16:00',
    tone: 'available',
    booked: false,
    meetingUrl: null,
  },
  {
    id: 'room-pod-3',
    name: 'Library Pod 3',
    type: 'Physical room',
    capacity: 4,
    availability: 'Available at 14:30',
    tone: 'soon',
    booked: false,
    meetingUrl: null,
  },
  {
    id: 'room-team-a',
    name: 'Team A Virtual Room',
    type: 'Online room',
    capacity: 99,
    availability: 'Open all day',
    tone: 'available',
    booked: false,
    meetingUrl: 'https://meet.jit.si/campus-hub-team-a',
  },
];

const fallbackPeople = [
  ['LM', 'Layla Mansour', 'Representative', '96%', 'Active now'],
  ['SK', 'Sami Kader', 'Student', '91%', '12m ago'],
  ['AZ', 'Amir Ziad', 'Student', '87%', '1h ago'],
  ['RH', 'Rana Haddad', 'Student', '94%', '2h ago'],
  ['NS', 'Noor Saleh', 'Student', '89%', 'Yesterday'],
];

const fallbackPosts = [
  {
    id: 'post-room-change',
    author: 'Layla Mansour',
    role: 'Representative',
    initials: 'LM',
    time: 'Today · 08:42',
    text: 'Tuesday’s DSA recitation has moved to Room B12. Same time, just across the courtyard.',
    pinned: true,
    helpful: 12,
    replies: 3,
    reacted: false,
  },
  {
    id: 'post-study-session',
    author: 'Sami Kader',
    role: 'Student',
    initials: 'SK',
    time: 'Yesterday · 18:16',
    text: 'Anyone up for a study session before Thursday’s quiz? I booked Library Pod 3 for 14:30.',
    pinned: false,
    helpful: 4,
    replies: 6,
    reacted: false,
  },
];

export default function CampusWorkspace() {
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState('dashboard');
  const [activeSub, setActiveSub] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [campus, setCampus] = useState<CampusState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [joinRole, setJoinRole] = useState<'student' | 'representative'>(
    'student',
  );
  const [joinCode, setJoinCode] = useState('');
  const [postText, setPostText] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);

  const loadCampus = async () => {
    const response = await fetch('/api/campus', { cache: 'no-store' });
    const data = (await response.json()) as CampusState & { error?: string };
    if (!response.ok)
      throw new Error(data.error || 'Campus Hub could not load.');
    if (!data.viewer && window.location.pathname === '/app') {
      window.location.assign('/signin');
      return;
    }
    setCampus(data);
  };

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get(
      'view',
    );
    if (
      requestedView &&
      [
        'dashboard',
        'schedule',
        'rooms',
        'community',
        'profile',
        'settings',
      ].includes(requestedView)
    )
      queueMicrotask(() => setActive(requestedView));
    void (async () => {
      try {
        await loadCampus();
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : 'Campus Hub could not load.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mutate = async (
    action: string,
    payload: Record<string, unknown> = {},
  ) => {
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/campus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = (await response.json()) as {
        error?: string;
        code?: string;
      };
      if (!response.ok)
        throw new Error(result.error || 'Your change could not be saved.');
      await loadCampus();
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Your change could not be saved.';
      setNotice(message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const go = (key: string) => {
    if (key === 'landing') {
      window.location.assign('/');
      return;
    }
    if (key === 'join') {
      window.location.assign('/signup');
      return;
    }
    if (key === 'subjects') {
      window.location.assign('/app/subjects');
      return;
    }
    setActive(key);
    setActiveSub(0);
    setDrawerOpen(false);
  };
  const submitPost = async (event: SubmitLike) => {
    event.preventDefault();
    if (!postText.trim()) return;
    try {
      await mutate('create_post', { text: postText.trim() });
      setPostText('');
      setNotice('Your post is live.');
    } catch {}
  };
  const bookRoom = async (roomId: string) => {
    try {
      await mutate('book_room', { roomId });
      setNotice('Your bookings are up to date.');
    } catch {}
  };
  const authenticate = async (
    action: 'signup' | 'login' | 'forgot_password',
    details: Record<string, unknown>,
  ) => {
    const result = await mutate(action, details);
    if (action !== 'forgot_password') {
      setJoinCode('');
      go('dashboard');
      setNotice(
        action === 'signup'
          ? 'Your account and course workspace are ready.'
          : 'Welcome back.',
      );
    }
    return result;
  };
  const logout = async () => {
    try {
      await mutate('logout');
      go('landing');
      setNotice('You have signed out.');
    } catch {}
  };
  const openEditor = (entity: string, query = '') =>
    window.location.assign(`/app/manage/${entity}${query ? `?${query}` : ''}`);
  const addSubject = () => openEditor('subject', 'mode=new');
  const editSubject = async (
    id: string,
    currentName: string,
    currentCode: string,
  ) =>
    openEditor(
      'subject',
      `mode=edit&id=${encodeURIComponent(id)}&name=${encodeURIComponent(currentName)}&code=${encodeURIComponent(currentCode)}`,
    );
  const deleteSubject = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} and its lectures and materials?`))
      return;
    try {
      await mutate('delete_subject', { id });
      setNotice(`${name} was removed.`);
    } catch {}
  };
  const addLecture = (subjectId: string) =>
    window.location.assign(
      `/app/subjects/${encodeURIComponent(subjectId)}/add-lecture`,
    );
  const addSchedule = () => openEditor('schedule', 'mode=new');
  const editSchedule = async (
    id: string,
    title: string,
    location: string,
    startsAt: string,
    endsAt: string,
  ) =>
    openEditor(
      'schedule',
      `mode=edit&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&location=${encodeURIComponent(location)}&startsAt=${encodeURIComponent(startsAt)}&endsAt=${encodeURIComponent(endsAt)}`,
    );
  const deleteSchedule = async (id: string, title: string) => {
    if (!window.confirm(`Remove ${title} from the schedule?`)) return;
    try {
      await mutate('delete_schedule', { id });
      setNotice('Schedule event removed.');
    } catch {}
  };
  const addRoom = () => openEditor('room', 'mode=new');
  const editRoom = (id: string, name: string, capacity: number) =>
    openEditor(
      'room',
      `mode=edit&id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}&capacity=${capacity}`,
    );
  const deleteRoom = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try {
      await mutate('delete_room', { id });
      setNotice('Room removed.');
    } catch {}
  };
  const deletePost = async (id: string) => {
    if (!window.confirm('Remove this post?')) return;
    try {
      await mutate('delete_post', { postId: id });
      setNotice('Post removed.');
    } catch {}
  };
  const editPost = (id: string, text: string) =>
    openEditor(
      'post',
      `mode=edit&id=${encodeURIComponent(id)}&text=${encodeURIComponent(text)}`,
    );
  const pinPost = async (id: string) => {
    try {
      await mutate('toggle_pin', { postId: id });
      setNotice('Announcement pin updated.');
    } catch {}
  };
  const reactToPost = async (postId: string) => {
    try {
      await mutate('toggle_reaction', { postId });
    } catch {}
  };
  const replyToPost = async (postId: string) => {
    const text = window.prompt('Write your reply');
    if (!text) return;
    try {
      await mutate('reply', { postId, text });
      setNotice('Your reply was posted.');
    } catch {}
  };
  const completeLecture = async (lectureId: string) => {
    try {
      await mutate('complete_lecture', { lectureId });
    } catch {}
  };
  const saveProfile = async (details: Record<string, unknown>) => {
    await mutate('update_profile', details);
    setNotice('Your profile was updated.');
  };
  const saveSettings = async (details: Record<string, unknown>) => {
    await mutate('update_settings', details);
    setNotice('Your preferences were saved.');
  };
  const submitApplication = async (details: Record<string, unknown>) => {
    await mutate('submit_application', details);
    setNotice('Application submitted successfully.');
  };
  const donate = async (amount: number, email: string) => {
    const result = (await mutate('create_donation', { amount, email })) as {
      url?: string;
    };
    if (result.url) window.location.assign(result.url);
  };

  const studentCode = campus?.joinCode.code ?? 'DSA2-K7Q1';
  const liveSubjects =
    campus?.subjects ??
    fallbackSubjects.map((item) => ({ ...item, id: item.code }));
  const liveRooms = campus?.rooms ?? fallbackRooms;
  const livePosts = campus?.posts ?? fallbackPosts;
  const livePeople =
    campus?.members ??
    fallbackPeople.map(([initials, name, role, attendance, lastActive]) => ({
      initials,
      name,
      role,
      attendance,
      lastActive,
    }));
  const liveSchedule =
    campus?.schedule ??
    fallbackScheduleDays.map((item, index) => {
      const startsAt = [
        '2026-08-30T09:00:00+03:00',
        '2026-08-31T11:00:00+03:00',
        '2026-09-01T10:00:00+03:00',
        '2026-09-02T14:00:00+03:00',
      ][index];
      return {
        id: String(index),
        startsAt,
        endsAt: new Date(
          new Date(startsAt).getTime() + 3_600_000,
        ).toISOString(),
        title: item.item,
        location: item.meta.split(' · ')[1],
        tone: item.tone,
        type: 'class',
        notes: '',
      };
    });

  return (
    <div className={dark ? 'campus-app dark' : 'campus-app'}>
      <header className="settings-bar">
        <button
          className="brand"
          type="button"
          onClick={() => go('landing')}
          aria-label="Campus Hub home"
        >
          <span className="brand-stamp">CH</span>
          <span>Campus Hub</span>
        </button>
        <div className="settings-actions">
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              setNotificationsOpen((value) => !value);
              if (campus?.viewer) void mutate('mark_notifications_read');
            }}
          >
            <Bell size={17} />
            {campus?.notifications.some((item) => !item.read) && (
              <span className="notification-dot" />
            )}
          </button>
          <button
            type="button"
            onClick={() => go('settings')}
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>
          {!campus?.viewer && (
            <button
              className="header-join"
              type="button"
              onClick={() => window.location.assign('/signin')}
            >
              Sign in
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Main navigation">
        <div className="nav-inner">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              className={
                active === key ? 'main-nav-item active' : 'main-nav-item'
              }
              key={key}
              type="button"
              onClick={() => go(key)}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="course-switcher-wrap">
          <button
            className="course-switcher"
            type="button"
            aria-expanded={courseMenuOpen}
            onClick={() => setCourseMenuOpen((value) => !value)}
          >
            <span className="course-dot">SE</span>
            <span>
              <strong>{campus?.course.name ?? 'Software Engineering'}</strong>
              <small>
                {campus?.course.yearLabel ?? 'Year 2'} ·{' '}
                {campus?.course.sectionLabel ?? 'Section A'}
              </small>
            </span>
            <ChevronDown size={15} />
          </button>
          {courseMenuOpen && (
            <div className="course-switcher-menu">
              <button type="button" onClick={() => setCourseMenuOpen(false)}>
                <span className="course-dot">SE</span>
                <span>
                  <strong>{campus?.course.name}</strong>
                  <small>Current course · {campus?.viewer?.role}</small>
                </span>
                <Check size={15} />
              </button>
              <a href="/app/courses">
                <BookOpen size={17} />
                <span>
                  <strong>See all courses</strong>
                  <small>Open your courses page</small>
                </span>
              </a>
            </div>
          )}
        </div>
      </nav>

      <div className="sub-nav" role="tablist" aria-label="Page views">
        {(subnav[active] || ['Overview']).map((item, index) => (
          <button
            className={activeSub === index ? 'active' : ''}
            key={item}
            type="button"
            onClick={() => setActiveSub(index)}
          >
            {item}
            {item === 'Announcements' && <span className="count">2</span>}
          </button>
        ))}
      </div>

      <main className="page" id="top">
        {loading && (
          <div className="live-banner">
            <RefreshCw className="spin" size={16} /> Connecting to your live
            course…
          </div>
        )}
        {notice && (
          <div className="live-banner notice">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')}>
              <X size={15} />
            </button>
          </div>
        )}
        {notificationsOpen && (
          <NotificationPanel
            notifications={campus?.notifications ?? []}
            close={() => setNotificationsOpen(false)}
            go={go}
          />
        )}
        {active === 'dashboard' && (
          <Dashboard
            view={activeSub}
            posts={livePosts}
            subjects={liveSubjects}
            onManage={() =>
              campus?.viewer?.role === 'representative' ||
              campus?.viewer?.role === 'admin'
                ? openEditor('course')
                : go('subjects')
            }
            onSchedule={() => go('schedule')}
            code={studentCode}
            viewer={campus?.viewer ?? null}
            schedule={liveSchedule}
          />
        )}
        {active === 'subjects' && (
          <Subjects
            view={activeSub}
            subjects={liveSubjects}
            lectures={campus?.lectures ?? []}
            materials={campus?.materials ?? []}
            onAdd={addSubject}
            onComplete={completeLecture}
            onEdit={editSubject}
            onDelete={deleteSubject}
            onAddLecture={addLecture}
            canManage={
              campus?.viewer?.role === 'representative' ||
              campus?.viewer?.role === 'admin'
            }
          />
        )}
        {active === 'schedule' && (
          <Schedule
            view={activeSub}
            schedule={liveSchedule}
            canManage={
              campus?.viewer?.role === 'representative' ||
              campus?.viewer?.role === 'admin'
            }
            onAdd={addSchedule}
            onEdit={editSchedule}
            onDelete={deleteSchedule}
          />
        )}
        {active === 'rooms' && (
          <Rooms
            view={activeSub}
            rooms={liveRooms}
            onBook={bookRoom}
            signedIn={Boolean(campus?.viewer)}
            saving={saving}
            onJoin={() => go('join')}
            canManage={
              campus?.viewer?.role === 'representative' ||
              campus?.viewer?.role === 'admin'
            }
            onAdd={addRoom}
            onEdit={editRoom}
            onDelete={deleteRoom}
          />
        )}
        {active === 'community' && (
          <Community
            view={activeSub}
            posts={livePosts}
            postText={postText}
            setPostText={setPostText}
            submitPost={submitPost}
            react={reactToPost}
            reply={replyToPost}
            viewer={campus?.viewer ?? null}
            onJoin={() => go('join')}
            saving={saving}
            people={livePeople}
            canManage={
              campus?.viewer?.role === 'representative' ||
              campus?.viewer?.role === 'admin'
            }
            onDelete={deletePost}
            onEdit={editPost}
            onPin={pinPost}
          />
        )}
        {active === 'profile' && (
          <Profile
            viewer={campus?.viewer ?? null}
            subjects={liveSubjects}
            onJoin={() => go('join')}
            onLogout={logout}
            onSave={saveProfile}
            onReload={loadCampus}
          />
        )}
        {active === 'settings' && (
          <SettingsPage
            dark={dark}
            setDark={setDark}
            settings={campus?.settings}
            signedIn={Boolean(campus?.viewer)}
            onSave={saveSettings}
            onJoin={() => go('join')}
          />
        )}
        {active === 'landing' && (
          <Landing
            onJoin={() => go('join')}
            onExplore={() => go('dashboard')}
          />
        )}
        {active === 'join' && (
          <Join
            role={joinRole}
            setRole={setJoinRole}
            code={joinCode}
            setCode={setJoinCode}
            onAuth={authenticate}
            saving={saving}
          />
        )}
        {active.startsWith('apply-') && (
          <ApplicationPage
            kind={active.replace('apply-', '')}
            opportunities={campus?.opportunities ?? []}
            applications={campus?.applications ?? []}
            viewer={campus?.viewer ?? null}
            submit={submitApplication}
            donate={donate}
            onJoin={() => go('join')}
            saving={saving}
            donationConfigured={campus?.donationConfigured ?? false}
          />
        )}
      </main>

      {drawerOpen && (
        <>
          <button
            className="drawer-scrim"
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="drawer" aria-label="Campus Hub menu">
            <div className="drawer-head">
              <div>
                <span className="eyebrow">COURSE LEDGER</span>
                <h2>Everything else</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <button
              className="profile-chip"
              type="button"
              onClick={() => go(campus?.viewer ? 'profile' : 'join')}
            >
              <span>{campus?.viewer?.initials ?? 'CH'}</span>
              <div>
                <strong>
                  {campus?.viewer?.fullName ?? 'Join your course'}
                </strong>
                <small>
                  {campus?.viewer
                    ? `${campus.viewer.role === 'admin' ? 'Administrator' : campus.viewer.role === 'representative' ? 'Representative' : 'Student'} · verified`
                    : 'Use your course code'}
                </small>
              </div>
              <ChevronDown size={15} />
            </button>
            <nav>
              {campus?.viewer?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => window.location.assign('/admin')}
                >
                  <BarChart3 size={18} />
                  <span>
                    <strong>Platform administration</strong>
                    <small>Accounts, courses and system access</small>
                  </span>
                </button>
              )}
              {campus?.viewer?.role === 'representative' && (
                <button type="button" onClick={() => openEditor('course')}>
                  <BookOpen size={18} />
                  <span>
                    <strong>Edit course</strong>
                    <small>Course details and course content</small>
                  </span>
                </button>
              )}
              {!campus?.viewer && (
                <button
                  type="button"
                  onClick={() => window.location.assign('/signin')}
                >
                  <ShieldCheck size={18} />
                  <span>
                    <strong>Sign in</strong>
                    <small>Open your verified course workspace</small>
                  </span>
                </button>
              )}
              <div className="drawer-divider" />
              <button type="button" onClick={() => go('apply-work')}>
                <BriefcaseBusiness size={18} />
                Apply to work
              </button>
              <button type="button" onClick={() => go('apply-scholarship')}>
                <GraduationCap size={18} />
                Apply for a scholarship
              </button>
              <button type="button" onClick={() => go('apply-volunteer')}>
                <HeartHandshake size={18} />
                Volunteer
              </button>
              <button type="button" onClick={() => go('apply-donate')}>
                <Gift size={18} />
                Donate to Campus Hub
              </button>
              <div className="drawer-divider" />
              <button type="button" onClick={() => go('profile')}>
                <CircleUserRound size={18} />
                Profile
              </button>
              <button type="button" onClick={() => go('settings')}>
                <Settings size={18} />
                Settings
              </button>
              <button type="button" onClick={() => go('landing')}>
                <Home size={18} />
                Public home
              </button>
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="welcome-row">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </section>
  );
}

function NotificationPanel({
  notifications,
  close,
  go,
}: {
  notifications: CampusState['notifications'];
  close: () => void;
  go: (target: string) => void;
}) {
  return (
    <aside className="notification-panel ledger-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">NOTIFICATIONS</span>
          <h2>What’s new</h2>
        </div>
        <button type="button" onClick={close} aria-label="Close notifications">
          <X size={17} />
        </button>
      </div>
      {notifications.length ? (
        notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            className="notification-item"
            onClick={() => {
              if (item.target) go(item.target);
              close();
            }}
          >
            <Bell size={16} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.body}</small>
            </span>
          </button>
        ))
      ) : (
        <div className="empty-inline">
          <Bell size={22} />
          <div>
            <strong>You’re all caught up</strong>
            <span>New course updates will appear here.</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function WorkspaceSubView({
  area,
  view,
  subjects = [],
  materials = [],
  schedule = [],
  rooms = [],
  posts = [],
  people = [],
  onBook,
}: {
  area: 'dashboard' | 'subjects' | 'schedule' | 'rooms' | 'community';
  view: number;
  subjects?: CampusState['subjects'];
  materials?: CampusState['materials'];
  schedule?: CampusState['schedule'];
  rooms?: CampusState['rooms'];
  posts?: CampusState['posts'];
  people?: CampusState['members'];
  onBook?: (id: string) => void;
}) {
  if (area === 'dashboard' && view === 1)
    return (
      <>
        <PageTitle
          eyebrow="MY PROGRESS"
          title="Your learning progress"
          description="Lecture completion and momentum across every active subject."
        />
        <div className="subpage-grid">
          {subjects.map((subject) => (
            <article className="ledger-card subpage-card" key={subject.id}>
              <span className="subject-monogram teal">{subject.icon}</span>
              <div>
                <h2>{subject.name}</h2>
                <p>
                  {subject.code} · {subject.viewed} of {subject.lectures}{' '}
                  lectures completed
                </p>
                <div className="progress">
                  <span
                    style={{
                      width: `${subject.lectures ? Math.round((subject.viewed / subject.lectures) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
              <strong>
                {subject.lectures
                  ? Math.round((subject.viewed / subject.lectures) * 100)
                  : 0}
                %
              </strong>
            </article>
          ))}
        </div>
      </>
    );
  if (area === 'dashboard')
    return (
      <>
        <PageTitle
          eyebrow="ANNOUNCEMENTS"
          title="Course announcements"
          description="Pinned notices and recent updates from your representative."
        />
        <div className="subpage-list">
          {posts
            .filter((post) => post.pinned)
            .map((post) => (
              <article
                className="ledger-card announcement-list-card"
                key={post.id}
              >
                <span>📌</span>
                <div>
                  <h2>{post.text}</h2>
                  <p>
                    {post.author} · {post.time}
                  </p>
                </div>
              </article>
            ))}
          {!posts.some((post) => post.pinned) && (
            <article className="ledger-card empty-inline">
              <Bell />
              <div>
                <strong>No pinned announcements</strong>
                <span>Important course notices will appear here.</span>
              </div>
            </article>
          )}
        </div>
      </>
    );
  if (area === 'subjects' && view === 1)
    return (
      <>
        <PageTitle
          eyebrow="CURRENT SEMESTER"
          title="Semester subjects"
          description="All subjects grouped into your active Year 2 semester."
        />
        <section className="ledger-card semester-panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">SEMESTER 1</span>
              <h2>{subjects.length} active subjects</h2>
            </div>
          </div>
          {subjects.map((subject) => (
            <div className="semester-row" key={subject.id}>
              <span className="subject-monogram teal">{subject.icon}</span>
              <div>
                <strong>{subject.name}</strong>
                <small>
                  {subject.code} · Next: {subject.next}
                </small>
              </div>
              <span>{subject.lectures} lectures</span>
            </div>
          ))}
        </section>
      </>
    );
  if (area === 'subjects')
    return (
      <>
        <PageTitle
          eyebrow="COURSE LIBRARY"
          title="All course materials"
          description="Open every file and reference shared across your subjects."
        />
        <section className="ledger-card materials-panel">
          {materials.map((item) => (
            <div className="material-row" key={item.id}>
              <span>
                <FileText size={18} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>
                  {
                    subjects.find((subject) => subject.id === item.subjectId)
                      ?.name
                  }{' '}
                  · {item.type}
                </small>
              </div>
              {item.url ? (
                <a
                  className="material-open"
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              ) : (
                <span className="warning-pill">PROCESSING</span>
              )}
            </div>
          ))}
        </section>
      </>
    );
  if (area === 'schedule' && view === 1)
    return (
      <>
        <PageTitle
          eyebrow="LIST VIEW"
          title="Every scheduled item"
          description="A chronological list of classes, exams, deadlines and study sessions."
        />
        <section className="ledger-card schedule-list-panel">
          {schedule.map((item) => (
            <article key={item.id}>
              <span className="date-block">
                <small>
                  {new Date(item.startsAt)
                    .toLocaleDateString('en', { month: 'short' })
                    .toUpperCase()}
                </small>
                <strong>{new Date(item.startsAt).getDate()}</strong>
              </span>
              <div>
                <h2>{item.title}</h2>
                <p>
                  {new Date(item.startsAt).toLocaleString()} · {item.location}
                </p>
              </div>
              <span className="warning-pill">{item.type}</span>
            </article>
          ))}
        </section>
      </>
    );
  if (area === 'schedule') {
    const deadlines = schedule.filter(
      (item) => item.type === 'exam' || item.type === 'deadline',
    );
    return (
      <>
        <PageTitle
          eyebrow="EXAMS & DEADLINES"
          title="Important academic dates"
          description="Assessment dates and submission deadlines that need your attention."
        />
        <div className="subpage-grid">
          {deadlines.map((item) => (
            <article className="ledger-card deadline-detail-card" key={item.id}>
              <span className="warning-pill">{item.type}</span>
              <h2>{item.title}</h2>
              <p>
                {new Date(item.startsAt).toLocaleString()} · {item.location}
              </p>
              <small>{item.notes || 'No additional instructions.'}</small>
            </article>
          ))}
          {!deadlines.length && (
            <article className="ledger-card empty-inline">
              <CalendarDays />
              <div>
                <strong>No upcoming exams or deadlines</strong>
                <span>New academic dates will appear here.</span>
              </div>
            </article>
          )}
        </div>
      </>
    );
  }
  if (area === 'rooms' && view === 1)
    return (
      <>
        <PageTitle
          eyebrow="BOOK A ROOM"
          title="Choose your study space"
          description="Select an available physical or online room."
        />
        <div className="subpage-grid">
          {rooms.map((room) => (
            <article className="ledger-card compact-room" key={room.id}>
              <DoorOpen />
              <div>
                <h2>{room.name}</h2>
                <p>
                  {room.capacity} seats · {room.availability}
                </p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => onBook?.(room.id)}
              >
                {room.booked ? 'Cancel booking' : 'Book room'}
              </button>
            </article>
          ))}
        </div>
      </>
    );
  if (area === 'rooms') {
    const booked = rooms.filter((room) => room.booked);
    return (
      <>
        <PageTitle
          eyebrow="MY BOOKINGS"
          title="Your reserved spaces"
          description="Manage the study spaces you have already booked."
        />
        <div className="subpage-grid">
          {booked.map((room) => (
            <article className="ledger-card compact-room" key={room.id}>
              <Check />
              <div>
                <h2>{room.name}</h2>
                <p>{room.availability}</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onBook?.(room.id)}
              >
                Cancel
              </button>
            </article>
          ))}
          {!booked.length && (
            <article className="ledger-card empty-inline">
              <DoorOpen />
              <div>
                <strong>No active bookings</strong>
                <span>Use Book a room to reserve a space.</span>
              </div>
            </article>
          )}
        </div>
      </>
    );
  }
  if (area === 'community' && view === 1)
    return (
      <>
        <PageTitle
          eyebrow="DISCUSSIONS"
          title="Active course discussions"
          description="Questions and study conversations from your classmates."
        />
        <div className="subpage-list">
          {posts
            .filter((post) => !post.pinned)
            .map((post) => (
              <article className="ledger-card discussion-card" key={post.id}>
                <span className="avatar">{post.initials}</span>
                <div>
                  <h2>{post.text}</h2>
                  <p>
                    {post.author} · {post.replies} replies · {post.helpful}{' '}
                    helpful
                  </p>
                </div>
              </article>
            ))}
        </div>
      </>
    );
  const representatives = people.filter((person) =>
    person.role.toLowerCase().includes('representative'),
  );
  return (
    <>
      <PageTitle
        eyebrow="COURSE GROUPS"
        title="People and study groups"
        description="Find your course leaders and the classmates learning with you."
      />
      <div className="subpage-grid">
        <article className="ledger-card group-card">
          <Users />
          <h2>Section A students</h2>
          <p>{people.length} verified members</p>
          <div>
            {people.slice(0, 5).map((person) => (
              <span className="avatar" key={person.name}>
                {person.initials}
              </span>
            ))}
          </div>
        </article>
        <article className="ledger-card group-card">
          <ShieldCheck />
          <h2>Course representatives</h2>
          <p>{representatives.length} course leader</p>
          {representatives.map((person) => (
            <div className="member-mini" key={person.name}>
              <span className="avatar">{person.initials}</span>
              <div>
                <strong>{person.name}</strong>
                <small>{person.role}</small>
              </div>
            </div>
          ))}
        </article>
      </div>
    </>
  );
}

function Dashboard({
  view,
  posts,
  subjects,
  onManage,
  onSchedule,
  code,
  viewer,
  schedule,
}: {
  view: number;
  posts: CampusState['posts'];
  subjects: CampusState['subjects'];
  onManage: () => void;
  onSchedule: () => void;
  code: string;
  viewer: CampusState['viewer'];
  schedule: CampusState['schedule'];
}) {
  const scheduleDays = schedule.slice(0, 4).map((entry) => {
    const date = new Date(entry.startsAt);
    return {
      day: date.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(),
      date: String(date.getDate()).padStart(2, '0'),
      item: entry.title,
      meta: `${date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${entry.location}`,
      tone: entry.tone,
    };
  });
  if (view > 0)
    return (
      <WorkspaceSubView
        area="dashboard"
        view={view}
        posts={posts}
        subjects={subjects}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="LIVE COURSE LEDGER"
        title={`Morning, ${viewer?.fullName.split(' ')[0] ?? 'student'}.`}
        description={
          viewer
            ? 'Everything is on track. Here’s what needs your attention today.'
            : 'Explore the live course, then join with your code to post, book rooms and save progress.'
        }
        action={
          <button className="primary-button" type="button" onClick={onManage}>
            {viewer?.role === 'representative' ? (
              <>
                <BookOpen size={17} /> Edit course content
              </>
            ) : (
              <>
                <Users size={17} /> Join the course
              </>
            )}
          </button>
        }
      />
      <section className="metric-grid" aria-label="Course summary">
        <article className="metric-card feature-card">
          <div className="metric-head">
            <span>My attendance</span>
            <span className="trend">+2.4%</span>
          </div>
          <div className="metric-value">92%</div>
          <div className="progress">
            <span style={{ width: '92%' }} />
          </div>
          <p>Excellent standing · last 6 weeks</p>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Lectures viewed</span>
            <BookOpen size={17} />
          </div>
          <div className="metric-value">
            14 <small>/ 16</small>
          </div>
          <p>2 materials waiting this week</p>
        </article>
        <article className="metric-card">
          <div className="metric-head">
            <span>Next class</span>
            <CalendarDays size={17} />
          </div>
          <div className="metric-value time-value">Tue · 10:00</div>
          <p>DSA Recitation · Room B12</p>
        </article>
        <article className="metric-card code-card">
          <div className="metric-head">
            <span>Student join code</span>
            <span className="status">
              <i /> ACTIVE
            </span>
          </div>
          <div className="code-stamp">{code}</div>
          <p>12 joins this semester</p>
        </article>
      </section>
      <section className="dashboard-grid">
        <article className="ledger-card schedule-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">THE WEEK AHEAD</span>
              <h2>Upcoming classes</h2>
            </div>
            <button type="button" onClick={onSchedule}>
              View schedule →
            </button>
          </div>
          <div className="schedule-list">
            {scheduleDays.map((entry) => (
              <div className="schedule-row" key={`${entry.day}-${entry.item}`}>
                <div className="date-block">
                  <span>{entry.day}</span>
                  <strong>{entry.date}</strong>
                </div>
                <span className={`timeline-dot ${entry.tone}`} />
                <div className="schedule-copy">
                  <strong>{entry.item}</strong>
                  <span>{entry.meta}</span>
                </div>
                {entry.day === 'TUE' && (
                  <span className="today-pill">NEXT</span>
                )}
              </div>
            ))}
          </div>
        </article>
        <aside className="side-stack">
          <article className="ledger-card announcement-card">
            <div className="pin-label">📌 PINNED BY YOUR REPRESENTATIVE</div>
            <h2>Room change this week</h2>
            <p>
              Tuesday’s DSA recitation has moved to Room B12. Same time, just
              across the courtyard.
            </p>
            <div className="author">
              <span>LM</span>
              <div>
                <strong>Layla Mansour</strong>
                <small>Today · 08:42</small>
              </div>
            </div>
          </article>
          <article className="ledger-card checklist-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">PERSONAL PROGRESS</span>
                <h2>Keep the streak</h2>
              </div>
              <span className="fraction">3/5</span>
            </div>
            {[
              'Watch Lecture 08 recording',
              'Review linked-list notes',
              'Complete quiz preparation',
            ].map((task, index) => (
              <label key={task}>
                <span className={index < 2 ? 'check checked' : 'check'}>
                  {index < 2 && <Check size={13} />}
                </span>
                <span>{task}</span>
              </label>
            ))}
          </article>
        </aside>
      </section>
    </>
  );
}

function Subjects({
  view,
  subjects,
  lectures,
  materials,
  onAdd,
  onComplete,
  onEdit,
  onDelete,
  onAddLecture,
  canManage,
}: {
  view: number;
  subjects: CampusState['subjects'];
  lectures: CampusState['lectures'];
  materials: CampusState['materials'];
  onAdd: () => void;
  onComplete: (id: string) => void;
  onEdit: (id: string, name: string, code: string) => void;
  onDelete: (id: string, name: string) => void;
  onAddLecture: (subjectId: string) => void;
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const subject = subjects.find((item) => item.id === selected);
  if (view > 0)
    return (
      <WorkspaceSubView
        area="subjects"
        view={view}
        subjects={subjects}
        materials={materials}
      />
    );
  if (subject)
    return (
      <>
        <PageTitle
          eyebrow={subject.code}
          title={subject.name}
          description={`Next focus: ${subject.next}`}
          action={
            <div className="context-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSelected(null)}
              >
                ← All subjects
              </button>
              {canManage && (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      onEdit(subject.id, subject.name, subject.code)
                    }
                  >
                    Edit subject
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => onAddLecture(subject.id)}
                  >
                    <Plus size={16} />
                    Add lecture
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => onDelete(subject.id, subject.name)}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          }
        />
        <div className="subject-detail-grid">
          <article className="ledger-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">LECTURES</span>
                <h2>Course outline</h2>
              </div>
            </div>
            {lectures
              .filter((item) => item.subjectId === subject.id)
              .map((lecture) => (
                <button
                  className="lecture-row"
                  type="button"
                  key={lecture.id}
                  onClick={() => onComplete(lecture.id)}
                >
                  <span
                    className={lecture.completed ? 'check checked' : 'check'}
                  >
                    {lecture.completed && <Check size={13} />}
                  </span>
                  <span>
                    <strong>
                      {String(lecture.position).padStart(2, '0')} ·{' '}
                      {lecture.title}
                    </strong>
                    <small>{lecture.summary}</small>
                  </span>
                  <span>
                    {lecture.completed ? 'Completed' : 'Mark complete'}
                  </span>
                </button>
              ))}
          </article>
          <article className="ledger-card">
            <span className="eyebrow">FILES & LINKS</span>
            <h2>Materials</h2>
            {materials
              .filter((item) => item.subjectId === subject.id)
              .map((item) => (
                <div className="material-row" key={item.id}>
                  <span>
                    <FileText size={18} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.type} ·{' '}
                      {item.size
                        ? `${(item.size / 1048576).toFixed(1)} MB`
                        : 'External resource'}
                    </small>
                  </div>
                  {item.url ? (
                    <a
                      className="material-open"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span>Unavailable</span>
                  )}
                </div>
              )) || <p>No materials yet.</p>}
          </article>
        </div>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="COURSE MATERIALS"
        title="What’s in this course"
        description="Every lecture, file and recording—kept in order by your representative."
        action={
          canManage ? (
            <button className="primary-button" type="button" onClick={onAdd}>
              <Plus size={17} /> Add subject
            </button>
          ) : undefined
        }
      />
      <div className="subject-grid">
        {subjects.map((item) => {
          const progress = item.lectures
            ? Math.round((item.viewed / item.lectures) * 100)
            : 0;
          return (
            <article className={`subject-card ${item.color}`} key={item.id}>
              <div className="subject-top">
                <span className="subject-monogram">{item.icon}</span>
                <BookOpen size={18} />
              </div>
              <span className="eyebrow">{item.code}</span>
              <h2>{item.name}</h2>
              <p>Next: {item.next}</p>
              <div className="subject-progress">
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="subject-meta">
                <span>
                  {item.viewed}/{item.lectures} completed
                </span>
                <strong>{progress}%</strong>
              </div>
              <button
                className="card-link"
                type="button"
                onClick={() => setSelected(item.id)}
              >
                Open subject <span>→</span>
              </button>
              {canManage && (
                <div className="inline-admin-actions">
                  <button
                    type="button"
                    onClick={() => onEdit(item.id, item.name, item.code)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => onDelete(item.id, item.name)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <article className="ledger-card materials-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">LATEST MATERIALS</span>
            <h2>Recently added</h2>
          </div>
        </div>
        {materials.slice(0, 4).map((item) => (
          <div className="material-row" key={item.id}>
            <span>
              {item.type === 'link' ? (
                <ExternalLink size={18} />
              ) : (
                <Download size={18} />
              )}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>
                {
                  subjects.find((subject) => subject.id === item.subjectId)
                    ?.name
                }{' '}
                · {item.type}
              </small>
            </div>
            {item.url && (
              <a
                className="material-open"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            )}
          </div>
        ))}
      </article>
    </>
  );
}

function Schedule({
  view,
  schedule,
  canManage,
  onAdd,
  onEdit,
  onDelete,
}: {
  view: number;
  schedule: CampusState['schedule'];
  canManage: boolean;
  onAdd: () => void;
  onEdit: (
    id: string,
    title: string,
    location: string,
    startsAt: string,
    endsAt: string,
  ) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const weekdays = [
    'Sunday 30',
    'Monday 31',
    'Tuesday 01',
    'Wednesday 02',
    'Thursday 03',
  ];
  const exportCalendar = () => {
    const stamp = (date: string) =>
      new Date(date)
        .toISOString()
        .replaceAll('-', '')
        .replaceAll(':', '')
        .replace(/\.\d{3}/, '');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Campus Hub//Course Schedule//EN',
      ...schedule.flatMap((item) => [
        'BEGIN:VEVENT',
        `UID:${item.id}@campushub`,
        `DTSTART:${stamp(item.startsAt)}`,
        `DTEND:${stamp(item.endsAt)}`,
        `SUMMARY:${item.title.replaceAll(',', '\\,')}`,
        `LOCATION:${item.location.replaceAll(',', '\\,')}`,
        `DESCRIPTION:${item.notes.replaceAll(',', '\\,')}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join('\r\n')], { type: 'text/calendar' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campus-hub-schedule.ics';
    link.click();
    URL.revokeObjectURL(url);
  };
  if (view > 0)
    return <WorkspaceSubView area="schedule" view={view} schedule={schedule} />;
  return (
    <>
      <PageTitle
        eyebrow="ACADEMIC WEEK 06"
        title="Your week, at a glance"
        description="Classes, study sessions, exams and deadlines in one clear schedule."
        action={
          <div className="context-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={exportCalendar}
            >
              <Download size={16} /> Export .ics
            </button>
            {canManage && (
              <button className="primary-button" type="button" onClick={onAdd}>
                <Plus size={16} />
                Add event
              </button>
            )}
          </div>
        }
      />
      <article className="ledger-card calendar-panel">
        <div className="calendar-head">
          <span>GMT+3</span>
          {weekdays.map((day) => (
            <strong key={day}>{day}</strong>
          ))}
        </div>
        {['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((time) => (
          <div className="calendar-row" key={time}>
            <span>{time}</span>
            {weekdays.map((day, col) => {
              const entry = schedule.find((item) => {
                const date = new Date(item.startsAt);
                return (
                  date.getDay() === col &&
                  date.getHours() === Number(time.slice(0, 2))
                );
              });
              return (
                <div key={day}>
                  {entry && (
                    <>
                      <button
                        className={
                          entry.tone === 'amber'
                            ? 'calendar-event amber'
                            : 'calendar-event'
                        }
                        type="button"
                        title={entry.notes}
                        onClick={() =>
                          canManage &&
                          onEdit(
                            entry.id,
                            entry.title,
                            entry.location,
                            entry.startsAt,
                            entry.endsAt,
                          )
                        }
                      >
                        <strong>{entry.title}</strong>
                        <small>{entry.location}</small>
                      </button>
                      {canManage && (
                        <button
                          className="calendar-remove"
                          type="button"
                          onClick={() => onDelete(entry.id, entry.title)}
                          aria-label={`Remove ${entry.title}`}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </article>
      <div className="deadline-strip">
        <article>
          <span className="deadline-date">
            SEP
            <br />
            <strong>03</strong>
          </span>
          <div>
            <span className="eyebrow">UPCOMING DEADLINE</span>
            <h3>Graph theory problem set</h3>
            <p>Discrete Mathematics · due at 23:59</p>
          </div>
          <span className="warning-pill">5 DAYS</span>
        </article>
        <article>
          <span className="deadline-date exam">
            SEP
            <br />
            <strong>08</strong>
          </span>
          <div>
            <span className="eyebrow">EXAM</span>
            <h3>Operating Systems quiz</h3>
            <p>Lab 2 · 10:00–10:45</p>
          </div>
          <span className="warning-pill">10 DAYS</span>
        </article>
      </div>
    </>
  );
}

function Rooms({
  view,
  rooms,
  onBook,
  signedIn,
  saving,
  onJoin,
  canManage,
  onAdd,
  onEdit,
  onDelete,
}: {
  view: number;
  rooms: CampusState['rooms'];
  onBook: (id: string) => void;
  signedIn: boolean;
  saving: boolean;
  onJoin: () => void;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (id: string, name: string, capacity: number) => void;
  onDelete: (id: string, name: string) => void;
}) {
  const [availableOnly, setAvailableOnly] = useState(false);
  const bookedRoom = rooms.find((room) => room.booked)?.id ?? null;
  if (view > 0)
    return (
      <WorkspaceSubView
        area="rooms"
        view={view}
        rooms={rooms}
        onBook={onBook}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="STUDY ROOMS"
        title="Find a place to work"
        description="Book a campus space or join a virtual room with your classmates."
        action={
          <div className="context-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setAvailableOnly((value) => !value)}
            >
              <Search size={16} />
              {availableOnly ? 'Show all rooms' : 'Available now'}
            </button>
            {canManage && (
              <button className="primary-button" type="button" onClick={onAdd}>
                <Plus size={16} />
                Add room
              </button>
            )}
          </div>
        }
      />
      {bookedRoom && (
        <div className="success-banner">
          <Check size={18} />
          <div>
            <strong>Room booked.</strong>
            <span>
              Your booking was added to My bookings and your schedule.
            </span>
          </div>
          <button type="button" onClick={() => onBook(bookedRoom)}>
            Undo
          </button>
        </div>
      )}
      <div className="room-grid">
        {rooms
          .filter((room) => !availableOnly || room.tone === 'available')
          .map((room) => (
            <article className="room-card ledger-card" key={room.id}>
              <div className="room-visual">
                <DoorOpen size={28} />
                <span className={`room-status ${room.tone}`}>
                  {room.tone === 'available' ? 'AVAILABLE' : 'SOON'}
                </span>
              </div>
              <span className="eyebrow">{room.type}</span>
              <h2>{room.name}</h2>
              <p>
                {room.capacity > 50
                  ? 'Unlimited seats'
                  : `${room.capacity} seats`}
              </p>
              <div className="room-time">
                <Clock3 size={15} />
                {room.availability}
              </div>
              {room.meetingUrl && signedIn ? (
                <a
                  className="secondary-button room-link"
                  href={room.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open virtual room <ExternalLink size={14} />
                </a>
              ) : (
                <button
                  className={
                    room.booked ? 'secondary-button booked' : 'primary-button'
                  }
                  type="button"
                  disabled={saving}
                  onClick={() => (signedIn ? onBook(room.id) : onJoin())}
                >
                  {room.booked ? (
                    <>
                      <Check size={16} /> Booked
                    </>
                  ) : signedIn ? (
                    'Book room'
                  ) : (
                    'Sign in to book'
                  )}
                </button>
              )}
              {canManage && (
                <div className="inline-admin-actions">
                  <button
                    type="button"
                    onClick={() => onEdit(room.id, room.name, room.capacity)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => onDelete(room.id, room.name)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </article>
          ))}
      </div>
      <article className="ledger-card booking-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">MY BOOKINGS</span>
            <h2>Coming up</h2>
          </div>
        </div>
        <div className="empty-inline">
          <CalendarDays size={25} />
          <div>
            <strong>
              {bookedRoom ? 'One booking this week' : 'No rooms booked yet'}
            </strong>
            <span>
              {bookedRoom
                ? 'Tuesday · 14:30–15:30 · added to schedule'
                : 'Your confirmed study rooms will appear here.'}
            </span>
          </div>
        </div>
      </article>
    </>
  );
}

function Community({
  view,
  posts,
  postText,
  setPostText,
  submitPost,
  react,
  reply,
  viewer,
  onJoin,
  saving,
  people,
  canManage,
  onDelete,
  onEdit,
  onPin,
}: {
  view: number;
  posts: CampusState['posts'];
  postText: string;
  setPostText: (value: string) => void;
  submitPost: (event: SubmitLike) => void;
  react: (id: string) => void;
  reply: (id: string) => void;
  viewer: CampusState['viewer'];
  onJoin: () => void;
  saving: boolean;
  people: CampusState['members'];
  canManage: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onPin: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (view > 0)
    return (
      <WorkspaceSubView
        area="community"
        view={view}
        posts={posts}
        people={people}
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="SECTION A COMMUNITY"
        title="Your classmates, all together"
        description="A private course feed visible only to verified members of your section."
      />
      <div className="community-grid">
        <section>
          {viewer ? (
            <form className="compose-card ledger-card" onSubmit={submitPost}>
              <span className="avatar">{viewer.initials}</span>
              <label>
                <span className="sr-only">Write a post</span>
                <textarea
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  placeholder="Share an update or ask your course a question…"
                  maxLength={1500}
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!postText.trim() || saving}
              >
                <Send size={15} /> {saving ? 'Posting…' : 'Post'}
              </button>
            </form>
          ) : (
            <button
              className="compose-card ledger-card join-feed"
              type="button"
              onClick={onJoin}
            >
              <Users size={20} />
              <span>
                <strong>Sign in to take part</strong>
                <small>Create your verified account to post and reply.</small>
              </span>
            </button>
          )}
          {posts.length ? (
            posts.map((post) => (
              <article
                className={
                  post.pinned
                    ? 'post-card ledger-card pinned'
                    : 'post-card ledger-card'
                }
                key={post.id}
              >
                {post.pinned && (
                  <span className="pin-label">📌 PINNED ANNOUNCEMENT</span>
                )}
                <div className="post-head">
                  <span className="avatar">{post.initials}</span>
                  <div>
                    <strong>{post.author}</strong>
                    <small>
                      {post.role} · {post.time}
                    </small>
                  </div>
                </div>
                <p>{post.text}</p>
                <div className="post-actions">
                  <button
                    className={post.reacted ? 'reacted' : ''}
                    type="button"
                    onClick={() => (viewer ? react(post.id) : onJoin())}
                  >
                    ♡ Helpful <span>{post.helpful}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => (viewer ? reply(post.id) : onJoin())}
                  >
                    💬 Reply <span>{post.replies}</span>
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => onEdit(post.id, post.text)}
                      >
                        Edit
                      </button>
                      <button type="button" onClick={() => onPin(post.id)}>
                        {post.pinned ? 'Unpin' : '📌 Pin'}
                      </button>
                      <button
                        className="danger-text"
                        type="button"
                        onClick={() => onDelete(post.id)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))
          ) : (
            <article className="ledger-card empty-profile">
              <MessageCircle size={25} />
              <h2>Start the conversation</h2>
              <p>There are no posts in this course yet.</p>
            </article>
          )}
        </section>
        <aside className="ledger-card course-members">
          <span className="eyebrow">COURSE MEMBERS</span>
          <h2>Who’s here</h2>
          {people.slice(0, showAll ? people.length : 4).map((person) => (
            <div className="member-mini" key={person.name}>
              <span className="avatar">{person.initials}</span>
              <div>
                <strong>{person.name}</strong>
                <small>{person.role}</small>
              </div>
              <i />
            </div>
          ))}
          {people.length > 4 && (
            <button
              className="card-link"
              type="button"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? 'Show fewer members'
                : `View all ${people.length} members →`}
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

// oxlint-disable-next-line no-unused-vars -- retained temporarily for safe migration of legacy representative bookmarks.
function Manage({
  code,
  status,
  setStatus,
  changeCode,
  addContent,
  people,
  saving,
}: {
  code: string;
  status: 'active' | 'paused' | 'invalid';
  setStatus: (value: 'active' | 'paused' | 'invalid') => void;
  changeCode: () => void;
  addContent: () => void;
  people: CampusState['members'];
  saving: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = people.filter((person) =>
    person.name.toLowerCase().includes(query.toLowerCase()),
  );
  const exportRoster = () => {
    const csv = [
      'Name,Role,Attendance,Last active',
      ...people.map((person) =>
        [person.name, person.role, person.attendance, person.lastActive]
          .map((part) => `"${part.replaceAll('"', '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campus-hub-roster.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageTitle
        eyebrow="REPRESENTATIVE WORKSPACE"
        title="Manage Software Engineering"
        description="Keep Section A’s people, access and course health in one accountable place."
        action={
          <button className="primary-button" type="button" onClick={addContent}>
            <Plus size={17} /> Add content
          </button>
        }
      />
      <section className="manage-grid">
        <article className="ledger-card code-manager">
          <div className="section-head">
            <div>
              <span className="eyebrow">STUDENT ACCESS</span>
              <h2>Student join code</h2>
            </div>
            <span className={`large-status ${status}`}>
              <i />
              {status.toUpperCase()}
            </span>
          </div>
          <div className={`code-stamp large ${status}`}>{code}</div>
          <p>
            Share this with verified students in Software Engineering · Year 2 ·
            Section A.
          </p>
          <div className="button-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => navigator.clipboard.writeText(code)}
            >
              <Copy size={15} /> Copy
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={() =>
                setStatus(status === 'paused' ? 'active' : 'paused')
              }
            >
              <Pause size={15} />
              {status === 'paused' ? 'Reactivate' : 'Pause joins'}
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={changeCode}
            >
              <RefreshCw size={15} /> Regenerate
            </button>
          </div>
          <div className="audit-note">
            <ShieldCheck size={16} />
            <span>Every code change is recorded in the course audit log.</span>
          </div>
        </article>
        <article className="ledger-card health-card">
          <span className="eyebrow">COURSE HEALTH</span>
          <div className="health-score">
            <strong>91</strong>
            <span>
              /100
              <br />
              Excellent
            </span>
          </div>
          {[
            ['Average attendance', '91%', 91],
            ['Lecture completion', '84%', 84],
            ['Weekly engagement', '76%', 76],
          ].map(([label, value, width]) => (
            <div className="health-row" key={String(label)}>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <div>
                <i style={{ width: `${width}%` }} />
              </div>
            </div>
          ))}
        </article>
      </section>
      <article className="ledger-card roster-panel">
        <div className="section-head">
          <div>
            <span className="eyebrow">{people.length} VERIFIED MEMBERS</span>
            <h2>Course roster</h2>
          </div>
          <div className="roster-actions">
            <label>
              <Search size={15} />
              <input
                placeholder="Search members"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={exportRoster}
            >
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        <div className="roster-table">
          <div className="roster-table-head">
            <span>Member</span>
            <span>Role</span>
            <span>Attendance</span>
            <span>Last active</span>
            <span />
          </div>
          {filtered.map((person) => (
            <div className="roster-line" key={person.name}>
              <span className="person-cell">
                <i className="avatar">{person.initials}</i>
                <strong>{person.name}</strong>
              </span>
              <span
                className={
                  person.role === 'Representative'
                    ? 'role-pill rep'
                    : 'role-pill'
                }
              >
                {person.role}
              </span>
              <strong>{person.attendance}</strong>
              <span>{person.lastActive}</span>
              <ShieldCheck size={16} />
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

function Profile({
  viewer,
  subjects,
  onJoin,
  onLogout,
  onSave,
  onReload,
}: {
  viewer: CampusState['viewer'];
  subjects: CampusState['subjects'];
  onJoin: () => void;
  onLogout: () => void;
  onSave: (details: Record<string, unknown>) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  if (!viewer)
    return (
      <>
        <PageTitle
          eyebrow="YOUR CAMPUS IDENTITY"
          title="Join your real course"
          description="Create your private course profile with your course code."
          action={
            <button className="primary-button" type="button" onClick={onJoin}>
              Join Campus Hub →
            </button>
          }
        />
        <article className="ledger-card empty-profile">
          <ShieldCheck size={28} />
          <h2>Your course profile starts here</h2>
          <p>Membership details stay inside your verified course community.</p>
        </article>
      </>
    );
  const save = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await onSave(Object.fromEntries(data));
    setEditing(false);
  };
  const photo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.set('file', file);
      data.set('purpose', 'avatar');
      const response = await fetch('/api/files', {
        method: 'POST',
        body: data,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      await onReload();
    } finally {
      setUploading(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="VERIFIED CAMPUS IDENTITY"
        title={viewer.fullName}
        description="Your profile is visible only to course-mates and representatives in courses you join."
        action={
          <button className="secondary-button" type="button" onClick={onLogout}>
            Sign out
          </button>
        }
      />
      {editing ? (
        <form className="ledger-card profile-form" onSubmit={save}>
          <div className="section-head">
            <div>
              <span className="eyebrow">EDIT PROFILE</span>
              <h2>Academic identity</h2>
            </div>
            <button type="button" onClick={() => setEditing(false)}>
              <X size={17} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Full name
              <input
                name="fullName"
                defaultValue={viewer.fullName}
                required
                minLength={3}
              />
            </label>
            <label>
              University
              <input name="university" defaultValue={viewer.university} />
            </label>
            <label>
              College
              <input name="college" defaultValue={viewer.college} />
            </label>
            <label>
              Stage
              <input name="stage" defaultValue={viewer.stage} />
            </label>
            <label>
              Field
              <input name="field" defaultValue={viewer.field} />
            </label>
            <label className="span-two">
              Bio
              <textarea name="bio" defaultValue={viewer.bio} maxLength={500} />
            </label>
          </div>
          <button className="primary-button" type="submit">
            Save profile
          </button>
        </form>
      ) : (
        <div className="profile-grid">
          <article className="ledger-card identity-card">
            <div className="profile-avatar">
              {viewer.avatarUrl ? (
                <Image
                  className="profile-image"
                  src={viewer.avatarUrl}
                  alt={`${viewer.fullName} profile photo`}
                  fill
                  unoptimized
                  sizes="96px"
                />
              ) : (
                viewer.initials
              )}
              <span>
                <Check size={13} />
              </span>
            </div>
            <label className="photo-button">
              <Camera size={15} />
              {uploading ? 'Uploading…' : 'Change photo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={photo}
                disabled={uploading}
              />
            </label>
            <h2>{viewer.fullName}</h2>
            <p>
              {viewer.bio ||
                `Software Engineering ${viewer.role === 'representative' ? 'student and Section A representative' : 'student in Section A'}.`}
            </p>
            <div className="verified-line">
              <ShieldCheck size={17} /> Course membership verified
            </div>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{viewer.email}</dd>
              </div>
              <div>
                <dt>University</dt>
                <dd>{viewer.university}</dd>
              </div>
              <div>
                <dt>College</dt>
                <dd>{viewer.college}</dd>
              </div>
              <div>
                <dt>Stage & field</dt>
                <dd>
                  {viewer.stage} · {viewer.field}
                </dd>
              </div>
            </dl>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setEditing(true)}
            >
              Edit profile
            </button>
          </article>
          <article className="ledger-card progress-card">
            <span className="eyebrow">PROGRESS ACROSS COURSES</span>
            <h2>Academic snapshot</h2>
            {subjects.slice(0, 3).map((subject) => {
              const score = subject.lectures
                ? Math.round((subject.viewed / subject.lectures) * 100)
                : 0;
              return (
                <div className="course-progress" key={subject.code}>
                  <span className={`subject-monogram ${subject.color}`}>
                    {subject.icon}
                  </span>
                  <div>
                    <strong>{subject.name}</strong>
                    <small>
                      {subject.code} ·{' '}
                      {viewer.role === 'representative'
                        ? 'Representative'
                        : 'Student'}
                    </small>
                    <div className="subject-progress">
                      <span style={{ width: `${score}%` }} />
                    </div>
                  </div>
                  <strong>{score}%</strong>
                </div>
              );
            })}
          </article>
        </div>
      )}
    </>
  );
}

function SettingsPage({
  dark,
  setDark,
  settings,
  signedIn,
  onSave,
  onJoin,
}: {
  dark: boolean;
  setDark: (value: boolean) => void;
  settings?: CampusState['settings'];
  signedIn: boolean;
  onSave: (details: Record<string, unknown>) => Promise<void>;
  onJoin: () => void;
}) {
  const [notifications, setNotifications] = useState(
    settings?.announcements ?? true,
  );
  const [reminders, setReminders] = useState(settings?.reminders ?? true);
  const [productUpdates, setProductUpdates] = useState(
    settings?.productUpdates ?? false,
  );
  const [visibility, setVisibility] = useState(
    settings?.profileVisibility ?? 'course',
  );
  const save = () =>
    signedIn
      ? onSave({
          announcements: notifications,
          reminders,
          productUpdates,
          theme: dark ? 'dark' : 'light',
          profileVisibility: visibility,
          language: 'en',
        })
      : Promise.resolve(onJoin());
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT PREFERENCES"
        title="Settings"
        description="Control your account, notifications, privacy and appearance."
      />
      <div className="settings-grid">
        <article className="ledger-card settings-section">
          <span className="eyebrow">APPEARANCE</span>
          <h2>Make the ledger yours</h2>
          <div className="setting-line">
            <div>
              <strong>Dark mode</strong>
              <span>Use the low-light course ledger theme.</span>
            </div>
            <button
              className={dark ? 'switch on' : 'switch'}
              type="button"
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark mode"
              aria-pressed={dark}
            >
              <i />
            </button>
          </div>
          <div className="setting-line">
            <div>
              <strong>Interface language</strong>
              <span>English · العربية supported from the top bar</span>
            </div>
            <span>English</span>
          </div>
        </article>
        <article className="ledger-card settings-section">
          <span className="eyebrow">NOTIFICATIONS</span>
          <h2>Stay on track</h2>
          {[
            ['Course announcements', notifications, setNotifications],
            ['Schedule reminders', reminders, setReminders],
            ['Campus Hub updates', productUpdates, setProductUpdates],
          ].map(([label, state, setter]) => (
            <div className="setting-line" key={String(label)}>
              <div>
                <strong>{String(label)}</strong>
                <span>Control account and course updates.</span>
              </div>
              <button
                className={state ? 'switch on' : 'switch'}
                type="button"
                onClick={() => {
                  const change = setter as React.Dispatch<
                    React.SetStateAction<boolean>
                  >;
                  change(!state);
                }}
                aria-label={`Toggle ${String(label)}`}
                aria-pressed={Boolean(state)}
              >
                <i />
              </button>
            </div>
          ))}
        </article>
        <article className="ledger-card settings-section privacy-card">
          <span className="eyebrow">PRIVACY</span>
          <h2>Your real identity, protected</h2>
          <p>
            Only verified members of your courses can see your profile photo and
            academic details.
          </p>
          <label className="field-label">
            Profile visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              <option value="course">My course members</option>
              <option value="representatives">Representatives only</option>
            </select>
          </label>
          <button
            className="primary-button"
            type="button"
            onClick={() => void save()}
          >
            {signedIn ? 'Save preferences' : 'Sign in to save'}
          </button>
        </article>
      </div>
    </>
  );
}

function Landing({
  onJoin,
  onExplore,
}: {
  onJoin: () => void;
  onExplore: () => void;
}) {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div>
          <span className="eyebrow">
            BUILT BY STUDENTS · TRUSTED BY CLASSMATES
          </span>
          <h1>Your course, organized by the person who’s actually in it.</h1>
          <p>
            Campus Hub turns real student representatives into the organizing
            force behind lectures, schedules, rooms and course progress.
          </p>
          <div className="button-row">
            <button
              className="primary-button large-button"
              type="button"
              onClick={onJoin}
            >
              Join Campus Hub →
            </button>
            <button
              className="secondary-button large-button"
              type="button"
              onClick={onExplore}
            >
              Explore the live demo
            </button>
          </div>
          <div className="trust-row">
            <span>
              <ShieldCheck size={17} /> Verified identities
            </span>
            <span>
              <Users size={17} /> Course-only community
            </span>
            <span>
              <ClipboardCheck size={17} /> Accountable representatives
            </span>
          </div>
        </div>
        <div className="hero-ledger">
          <span className="tape">SECTION A</span>
          <div className="hero-ledger-head">
            <span className="brand-stamp">CH</span>
            <strong>Course ledger</strong>
            <small>Spring 2026</small>
          </div>
          {[
            ['Attendance', '92%'],
            ['Lectures', '14 / 16'],
            ['Next class', 'Tue · 10:00'],
          ].map(([label, value]) => (
            <div className="hero-stat" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="code-stamp large">DSA2-K7Q1</div>
        </div>
      </section>
      <section className="how-grid">
        <article>
          <span>01</span>
          <GraduationCap size={24} />
          <h2>Join your real course</h2>
          <p>
            Use the code from your representative and verify your academic
            identity.
          </p>
        </article>
        <article>
          <span>02</span>
          <BookOpen size={24} />
          <h2>Find everything in order</h2>
          <p>
            Lectures, schedules, materials and rooms live in one clean course
            ledger.
          </p>
        </article>
        <article>
          <span>03</span>
          <Users size={24} />
          <h2>Move together</h2>
          <p>
            Ask classmates, track progress and never miss a representative
            update.
          </p>
        </article>
      </section>
    </div>
  );
}

function Join({
  role,
  setRole,
  code,
  setCode,
  onAuth,
  saving,
}: {
  role: 'student' | 'representative';
  setRole: (role: 'student' | 'representative') => void;
  code: string;
  setCode: (value: string) => void;
  onAuth: (
    action: 'signup' | 'login' | 'forgot_password',
    details: Record<string, unknown>,
  ) => Promise<unknown>;
  saving: boolean;
}) {
  const [mode, setMode] = useState<'signup' | 'login' | 'forgot_password'>(
    'signup',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const valid =
    mode === 'forgot_password'
      ? validEmail
      : mode === 'login'
        ? validEmail && password.length > 0
        : validEmail &&
          password.length >= 10 &&
          code.length >= 8 &&
          fullName.trim().length >= 3;
  const submit = async (event: SubmitLike) => {
    event.preventDefault();
    setError('');
    try {
      await onAuth(mode, {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        code,
        role,
      });
      if (mode === 'forgot_password')
        setError(
          'If your account exists, recovery instructions will be sent when email delivery is connected.',
        );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Authentication failed.',
      );
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="SECURE CAMPUS ACCOUNT"
        title={
          mode === 'signup'
            ? 'Create your account'
            : mode === 'login'
              ? 'Welcome back'
              : 'Recover access'
        }
        description="Your password is protected with strong one-way hashing and your session stays private on this device."
      />
      <div className="join-layout">
        <form className="ledger-card join-form" onSubmit={submit}>
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
          </div>
          {mode === 'signup' && (
            <>
              <h2>Join your verified course</h2>
              <div className="role-choice">
                <button
                  className={role === 'student' ? 'active' : ''}
                  type="button"
                  onClick={() => setRole('student')}
                >
                  <UserRound size={23} />
                  <span>
                    <strong>I’m a student</strong>
                    <small>I have a student course code</small>
                  </span>
                  <i />
                </button>
                <button
                  className={role === 'representative' ? 'active' : ''}
                  type="button"
                  onClick={() => setRole('representative')}
                >
                  <Users size={23} />
                  <span>
                    <strong>I represent a course</strong>
                    <small>I have a representative code</small>
                  </span>
                  <i />
                </button>
              </div>
              <label className="field-label">
                Full name
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your real name"
                  autoComplete="name"
                />
              </label>
            </>
          )}
          <label className="field-label">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
              autoComplete="email"
            />
          </label>
          {mode !== 'forgot_password' && (
            <label className="field-label">
              Password
              <div className="code-input">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === 'signup'
                      ? '10+ characters, upper/lowercase and number'
                      : 'Your password'
                  }
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                />
                <span>
                  <LockKeyhole size={18} />
                </span>
              </div>
            </label>
          )}
          {mode === 'signup' && (
            <label className="field-label">
              {role === 'student'
                ? 'Student course code'
                : 'Representative code'}
              <div className="code-input">
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                  placeholder={
                    role === 'student' ? 'DSA2-••••' : 'REP-••••-•••'
                  }
                  autoComplete="off"
                />
                <span>
                  {valid ? <Check size={18} /> : <Search size={18} />}
                </span>
              </div>
            </label>
          )}
          {error && (
            <p
              className={
                error.startsWith('If your')
                  ? 'validation success'
                  : 'validation'
              }
            >
              {error}
            </p>
          )}
          <button
            className="primary-button join-continue"
            type="submit"
            disabled={!valid || saving}
          >
            {saving
              ? 'Working securely…'
              : mode === 'signup'
                ? 'Create account →'
                : mode === 'login'
                  ? 'Sign in →'
                  : 'Request recovery →'}
          </button>
          {mode === 'login' && (
            <button
              className="text-button"
              type="button"
              onClick={() => setMode('forgot_password')}
            >
              Forgot your password?
            </button>
          )}
          {mode === 'forgot_password' && (
            <button
              className="text-button"
              type="button"
              onClick={() => setMode('login')}
            >
              Back to sign in
            </button>
          )}
          <p className="form-note">
            <ShieldCheck size={15} /> Secure, HttpOnly session cookie · no
            password is ever stored in plain text
          </p>
        </form>
        <aside className="join-aside">
          <span className="eyebrow">REAL ACCOUNT PROTECTION</span>
          {[
            [
              'Private password storage',
              'Passwords are salted and hashed before storage.',
            ],
            [
              'Rate-limited sign in',
              'Repeated failed attempts are temporarily blocked.',
            ],
            [
              'Course-scoped access',
              'Your membership controls what you can view and change.',
            ],
          ].map(([title, text], index) => (
            <div className="join-step" key={title}>
              <span>{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}

function ApplicationPage({
  kind,
  opportunities,
  applications,
  viewer,
  submit,
  donate,
  onJoin,
  saving,
  donationConfigured,
}: {
  kind: string;
  opportunities: CampusState['opportunities'];
  applications: CampusState['applications'];
  viewer: CampusState['viewer'];
  submit: (details: Record<string, unknown>) => Promise<void>;
  donate: (amount: number, email: string) => Promise<void>;
  onJoin: () => void;
  saving: boolean;
  donationConfigured: boolean;
}) {
  const labels: Record<
    string,
    { title: string; icon: typeof BriefcaseBusiness; description: string }
  > = {
    work: {
      title: 'Student work',
      icon: BriefcaseBusiness,
      description:
        'Verified student-friendly roles with a clear application tracker.',
    },
    scholarship: {
      title: 'Scholarships',
      icon: GraduationCap,
      description:
        'Funding opportunities and organized submissions in one place.',
    },
    volunteer: {
      title: 'Volunteer',
      icon: HeartHandshake,
      description:
        'Give your skills to campus projects that need student energy.',
    },
    donate: {
      title: 'Support Campus Hub',
      icon: Gift,
      description:
        'Help keep student-led course organization accessible to everyone.',
    },
  };
  const data = labels[kind] || labels.work;
  const Icon = data.icon;
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState(20);
  const [email, setEmail] = useState(viewer?.email ?? '');
  const [error, setError] = useState('');
  const featured = opportunities.filter((item) => item.kind === kind);
  const apply = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await submit({ ...values, opportunityId: selected });
      setSelected(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Application failed.',
      );
    }
  };
  const pay = async () => {
    setError('');
    try {
      await donate(amount, email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Checkout failed.');
    }
  };
  if (kind === 'donate')
    return (
      <>
        <PageTitle
          eyebrow="TRANSPARENT STUDENT SUPPORT"
          title={data.title}
          description={data.description}
        />
        <div className="donation-layout">
          <section className="ledger-card donation-hero">
            <span className="opportunity-icon">
              <Gift size={26} />
            </span>
            <h2>Keep Campus Hub free for students</h2>
            <p>
              Your contribution helps fund secure Cloudflare storage,
              accessibility improvements, course materials, and student support.
              Payments use Stripe-hosted checkout; Campus Hub never receives
              your card number.
            </p>
            <div className="impact-grid">
              <div>
                <strong>$10</strong>
                <span>One month of storage</span>
              </div>
              <div>
                <strong>$25</strong>
                <span>Accessibility testing</span>
              </div>
              <div>
                <strong>$50</strong>
                <span>Support a new course</span>
              </div>
            </div>
          </section>
          <aside className="ledger-card donation-form">
            <span className="eyebrow">SECURE DONATION</span>
            <h2>Choose your amount</h2>
            <div className="amount-buttons">
              {[10, 20, 50, 100].map((value) => (
                <button
                  className={amount === value ? 'active' : ''}
                  type="button"
                  key={value}
                  onClick={() => setAmount(value)}
                >
                  ${value}
                </button>
              ))}
            </div>
            <label>
              Custom amount (USD)
              <input
                type="number"
                min="2"
                max="5000"
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
            </label>
            <label>
              Receipt email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {error && <p className="validation">{error}</p>}
            {!viewer ? (
              <button className="primary-button" type="button" onClick={onJoin}>
                Sign in to donate
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={() => void pay()}
                disabled={saving}
              >
                <CreditCard size={16} />
                {saving ? 'Opening checkout…' : `Donate $${amount} securely`}
              </button>
            )}
            <p className="form-note">
              <ShieldCheck size={14} />
              {donationConfigured
                ? 'Stripe checkout is connected.'
                : 'Checkout code is live; the owner must add Stripe keys to accept cards.'}
            </p>
          </aside>
        </div>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="CAMPUS OPPORTUNITIES"
        title={data.title}
        description={data.description}
      />
      <div className="opportunity-list">
        {featured.map((item) => (
          <section className="ledger-card opportunity-card" key={item.id}>
            <span className="opportunity-icon">
              <Icon size={26} />
            </span>
            <span className="eyebrow">VERIFIED · {item.organization}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <div className="opportunity-meta">
              <span>
                <Clock3 size={15} />
                Deadline: {new Date(item.deadline).toLocaleDateString()}
              </span>
              <span>
                <MapPin size={15} />
                {item.location}
              </span>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => (viewer ? setSelected(item.id) : onJoin())}
            >
              Apply now →
            </button>
          </section>
        ))}
      </div>
      {selected && (
        <div className="modal-scrim" role="presentation">
          <form className="modal-card ledger-card" onSubmit={apply}>
            <div className="section-head">
              <div>
                <span className="eyebrow">APPLICATION</span>
                <h2>{featured.find((item) => item.id === selected)?.title}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}>
                <X size={17} />
              </button>
            </div>
            <label>
              Phone number
              <input
                name="phone"
                autoComplete="tel"
                placeholder="Optional contact number"
              />
            </label>
            <label>
              Why are you a strong fit?
              <textarea
                name="statement"
                minLength={40}
                maxLength={2000}
                required
                placeholder="Share your experience, motivation and availability…"
              />
            </label>
            {error && <p className="validation">{error}</p>}
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit application'}
            </button>
          </form>
        </div>
      )}
      <article className="ledger-card status-tracker">
        <span className="eyebrow">MY APPLICATIONS</span>
        <h2>Status tracker</h2>
        {applications.filter((item) => item.kind === kind).length ? (
          applications
            .filter((item) => item.kind === kind)
            .map((item) => (
              <div className="application-status" key={item.id}>
                <FileText size={19} />
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    Submitted {new Date(item.createdAt).toLocaleDateString()}
                  </small>
                </span>
                <b>{item.status}</b>
              </div>
            ))
        ) : (
          <div className="empty-inline">
            <FileText size={24} />
            <div>
              <strong>No active applications</strong>
              <span>Your submitted applications will appear here.</span>
            </div>
          </div>
        )}
      </article>
    </>
  );
}
