'use client';

import {
  BarChart3, Bell, BookOpen, BriefcaseBusiness, CalendarDays, Check, ChevronDown,
  CircleUserRound, ClipboardCheck, Clock3, Copy, DoorOpen, Download, FileText,
  Gift, GraduationCap, HeartHandshake, Home, MapPin, Menu, MessageCircle,
  Moon, MoreHorizontal, Pause, PlayCircle, Plus, RefreshCw, Search, Send,
  Settings, ShieldCheck, Sun, TrendingUp, UserRound, Users, X,
} from 'lucide-react';
import { FormEvent, useState } from 'react';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', arabic: 'الرئيسية', icon: Home },
  { key: 'subjects', label: 'Subjects', arabic: 'المواد', icon: BookOpen },
  { key: 'schedule', label: 'Schedule', arabic: 'الجدول', icon: CalendarDays },
  { key: 'rooms', label: 'Study rooms', arabic: 'غرف الدراسة', icon: DoorOpen },
  { key: 'community', label: 'Community', arabic: 'المجتمع', icon: MessageCircle },
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

const scheduleDays = [
  { day: 'SUN', date: '30', item: 'Discrete Math', meta: '09:00 · Hall 3', tone: 'teal' },
  { day: 'MON', date: '31', item: 'Operating Systems', meta: '11:00 · Lab 2', tone: 'amber' },
  { day: 'TUE', date: '01', item: 'DSA recitation', meta: '10:00 · Room B12', tone: 'teal' },
  { day: 'WED', date: '02', item: 'Open study block', meta: '14:00 · Library', tone: 'plain' },
];

const subjects = [
  { name: 'Data Structures', code: 'CSE 221', color: 'teal', lectures: 8, viewed: 7, next: 'Trees & traversals', icon: 'DS' },
  { name: 'Discrete Mathematics', code: 'MTH 204', color: 'amber', lectures: 6, viewed: 5, next: 'Graph theory', icon: 'DM' },
  { name: 'Operating Systems', code: 'CSE 231', color: 'brick', lectures: 5, viewed: 2, next: 'Process scheduling', icon: 'OS' },
  { name: 'Technical Writing', code: 'ENG 207', color: 'navy', lectures: 4, viewed: 4, next: 'Research abstracts', icon: 'TW' },
];

const rooms = [
  { id: 1, name: 'Study Room B12', type: 'Physical room', meta: 'Open now · 6 seats', availability: 'Available until 16:00', tone: 'available' },
  { id: 2, name: 'Library Pod 3', type: 'Physical room', meta: '2 of 4 seats free', availability: 'Available at 14:30', tone: 'soon' },
  { id: 3, name: 'Team A Virtual Room', type: 'Online room', meta: 'Unlimited seats', availability: 'Open all day', tone: 'available' },
];

const people = [
  ['LM', 'Layla Mansour', 'Representative', '96%', 'Active now'],
  ['SK', 'Sami Kader', 'Student', '91%', '12m ago'],
  ['AZ', 'Amir Ziad', 'Student', '87%', '1h ago'],
  ['RH', 'Rana Haddad', 'Student', '94%', '2h ago'],
  ['NS', 'Noor Saleh', 'Student', '89%', 'Yesterday'],
];

export default function HomePage() {
  const [dark, setDark] = useState(false);
  const [arabic, setArabic] = useState(false);
  const [active, setActive] = useState('dashboard');
  const [activeSub, setActiveSub] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'active' | 'paused' | 'invalid'>('active');
  const [studentCode, setStudentCode] = useState('DSA2-K7Q1');
  const [codeIndex, setCodeIndex] = useState(0);
  const [bookedRoom, setBookedRoom] = useState<number | null>(null);
  const [joinRole, setJoinRole] = useState<'student' | 'representative'>('student');
  const [joinCode, setJoinCode] = useState('');
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState([
    { author: 'Layla Mansour', role: 'Representative', initials: 'LM', time: 'Today · 08:42', text: 'Tuesday’s DSA recitation has moved to Room B12. Same time, just across the courtyard.', pinned: true },
    { author: 'Sami Kader', role: 'Student', initials: 'SK', time: 'Yesterday · 18:16', text: 'Anyone up for a study session before Thursday’s quiz? I booked Library Pod 3 for 14:30.', pinned: false },
  ]);

  const go = (key: string) => { setActive(key); setActiveSub(0); setDrawerOpen(false); };
  const changeCode = () => {
    const nextCodes = ['DSA2-P4WX', 'DSA2-M8RH', 'DSA2-T6VK'];
    const next = (codeIndex + 1) % nextCodes.length;
    setCodeIndex(next); setStudentCode(nextCodes[next]); setCodeStatus('active');
  };
  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    if (!postText.trim()) return;
    setPosts([{ author: 'Layla Mansour', role: 'Representative', initials: 'LM', time: 'Just now', text: postText.trim(), pinned: false }, ...posts]);
    setPostText('');
  };

  return (
    <div className={dark ? 'campus-app dark' : 'campus-app'} dir={arabic ? 'rtl' : 'ltr'}>
      <header className="settings-bar">
        <button className="brand" type="button" onClick={() => go('landing')} aria-label="Campus Hub home"><span className="brand-stamp">CH</span><span>Campus Hub</span></button>
        <div className="settings-actions">
          <button className="language-button" type="button" onClick={() => setArabic((value) => !value)}>{arabic ? 'AR' : 'EN'}</button>
          <button type="button" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
          <button type="button" aria-label="Notifications"><Bell size={17} /></button>
          <button type="button" onClick={() => go('settings')} aria-label="Settings"><Settings size={17} /></button>
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Menu size={19} /></button>
        </div>
      </header>

      <nav className="main-nav" aria-label="Main navigation">
        <div className="nav-inner">
          {navItems.map(({ key, label, arabic: arLabel, icon: Icon }) => (
            <button className={active === key ? 'main-nav-item active' : 'main-nav-item'} key={key} type="button" onClick={() => go(key)}>
              <Icon size={18} strokeWidth={1.8} /><span>{arabic ? arLabel : label}</span>
            </button>
          ))}
        </div>
        <button className="course-switcher" type="button"><span className="course-dot">SE</span><span><strong>Software Engineering</strong><small>Year 2 · Section A</small></span><ChevronDown size={15} /></button>
      </nav>

      <div className="sub-nav" role="tablist" aria-label="Page views">
        {(subnav[active] || ['Overview']).map((item, index) => <button className={activeSub === index ? 'active' : ''} key={item} type="button" onClick={() => setActiveSub(index)}>{item}{item === 'Announcements' && <span className="count">2</span>}</button>)}
      </div>

      <main className="page" id="top">
        {active === 'dashboard' && <Dashboard onManage={() => go('manage')} code={studentCode} />}
        {active === 'subjects' && <Subjects />}
        {active === 'schedule' && <Schedule />}
        {active === 'rooms' && <Rooms bookedRoom={bookedRoom} onBook={setBookedRoom} />}
        {active === 'community' && <Community posts={posts} postText={postText} setPostText={setPostText} submitPost={submitPost} />}
        {active === 'manage' && <Manage code={studentCode} status={codeStatus} setStatus={setCodeStatus} changeCode={changeCode} />}
        {active === 'profile' && <Profile />}
        {active === 'settings' && <SettingsPage dark={dark} setDark={setDark} />}
        {active === 'landing' && <Landing onJoin={() => go('join')} onExplore={() => go('dashboard')} />}
        {active === 'join' && <Join role={joinRole} setRole={setJoinRole} code={joinCode} setCode={setJoinCode} onSuccess={() => go('dashboard')} />}
        {active.startsWith('apply-') && <ApplicationPage kind={active.replace('apply-', '')} />}
      </main>

      {drawerOpen && <><button className="drawer-scrim" type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)} /><aside className="drawer" aria-label="Campus Hub menu">
        <div className="drawer-head"><div><span className="eyebrow">COURSE LEDGER</span><h2>Everything else</h2></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        <button className="profile-chip" type="button" onClick={() => go('profile')}><span>LM</span><div><strong>Layla Mansour</strong><small>Representative · verified</small></div><ChevronDown size={15} /></button>
        <nav>
          <button type="button" onClick={() => go('manage')}><BarChart3 size={18} /><span><strong>Manage my course</strong><small>Members, codes & analytics</small></span></button>
          <div className="drawer-divider" />
          <button type="button" onClick={() => go('apply-work')}><BriefcaseBusiness size={18} />Apply to work</button>
          <button type="button" onClick={() => go('apply-scholarship')}><GraduationCap size={18} />Apply for a scholarship</button>
          <button type="button" onClick={() => go('apply-volunteer')}><HeartHandshake size={18} />Volunteer</button>
          <button type="button" onClick={() => go('apply-donate')}><Gift size={18} />Donate to Campus Hub</button>
          <div className="drawer-divider" />
          <button type="button" onClick={() => go('profile')}><CircleUserRound size={18} />Profile</button>
          <button type="button" onClick={() => go('settings')}><Settings size={18} />Settings</button>
          <button type="button" onClick={() => go('landing')}><Home size={18} />Public home</button>
        </nav>
      </aside></>}
    </div>
  );
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <section className="welcome-row"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</section>;
}

function Dashboard({ onManage, code }: { onManage: () => void; code: string }) {
  return <>
    <PageTitle eyebrow="SATURDAY · 29 AUGUST 2026" title="Morning, Layla." description="Your course ledger is tidy. Here’s what needs your attention today." action={<button className="primary-button" type="button" onClick={onManage}><BarChart3 size={17} /> Manage course</button>} />
    <section className="metric-grid" aria-label="Course summary">
      <article className="metric-card feature-card"><div className="metric-head"><span>My attendance</span><span className="trend">+2.4%</span></div><div className="metric-value">92%</div><div className="progress"><span style={{ width: '92%' }} /></div><p>Excellent standing · last 6 weeks</p></article>
      <article className="metric-card"><div className="metric-head"><span>Lectures viewed</span><BookOpen size={17} /></div><div className="metric-value">14 <small>/ 16</small></div><p>2 materials waiting this week</p></article>
      <article className="metric-card"><div className="metric-head"><span>Next class</span><CalendarDays size={17} /></div><div className="metric-value time-value">Tue · 10:00</div><p>DSA Recitation · Room B12</p></article>
      <article className="metric-card code-card"><div className="metric-head"><span>Student join code</span><span className="status"><i /> ACTIVE</span></div><div className="code-stamp">{code}</div><p>12 joins this semester</p></article>
    </section>
    <section className="dashboard-grid">
      <article className="ledger-card schedule-card"><div className="section-head"><div><span className="eyebrow">THE WEEK AHEAD</span><h2>Upcoming classes</h2></div><button type="button">View schedule →</button></div><div className="schedule-list">{scheduleDays.map((entry) => <div className="schedule-row" key={entry.day}><div className="date-block"><span>{entry.day}</span><strong>{entry.date}</strong></div><span className={`timeline-dot ${entry.tone}`} /><div className="schedule-copy"><strong>{entry.item}</strong><span>{entry.meta}</span></div>{entry.day === 'TUE' && <span className="today-pill">NEXT</span>}</div>)}</div></article>
      <aside className="side-stack"><article className="ledger-card announcement-card"><div className="pin-label">📌 PINNED BY YOUR REPRESENTATIVE</div><h2>Room change this week</h2><p>Tuesday’s DSA recitation has moved to Room B12. Same time, just across the courtyard.</p><div className="author"><span>LM</span><div><strong>Layla Mansour</strong><small>Today · 08:42</small></div></div></article><article className="ledger-card checklist-card"><div className="section-head"><div><span className="eyebrow">PERSONAL PROGRESS</span><h2>Keep the streak</h2></div><span className="fraction">3/5</span></div>{['Watch Lecture 08 recording', 'Review linked-list notes', 'Complete quiz preparation'].map((task, index) => <label key={task}><span className={index < 2 ? 'check checked' : 'check'}>{index < 2 && <Check size={13} />}</span><span>{task}</span></label>)}</article></aside>
    </section>
  </>;
}

function Subjects() {
  return <><PageTitle eyebrow="COURSE MATERIALS" title="What’s in this course" description="Every lecture, file and recording—kept in order by your representative." action={<button className="primary-button" type="button"><Plus size={17} /> Add subject</button>} />
    <div className="subject-grid">{subjects.map((subject) => <article className={`subject-card ${subject.color}`} key={subject.code}><div className="subject-top"><span className="subject-monogram">{subject.icon}</span><button type="button" aria-label={`More options for ${subject.name}`}><MoreHorizontal size={18} /></button></div><span className="eyebrow">{subject.code}</span><h2>{subject.name}</h2><p>Next: {subject.next}</p><div className="subject-progress"><span style={{ width: `${(subject.viewed / subject.lectures) * 100}%` }} /></div><div className="subject-meta"><span>{subject.viewed}/{subject.lectures} lectures viewed</span><strong>{Math.round((subject.viewed / subject.lectures) * 100)}%</strong></div><button className="card-link" type="button">Open subject <span>→</span></button></article>)}</div>
    <article className="ledger-card materials-panel"><div className="section-head"><div><span className="eyebrow">LATEST MATERIALS</span><h2>Recently added</h2></div><button type="button">View all →</button></div>{[['Tree traversal practice', 'Data Structures · PDF · 2.4 MB', FileText], ['Lecture 06 — Graph theory', 'Discrete Mathematics · Recording · 42 min', PlayCircle], ['Week 5 lab sheet', 'Operating Systems · PDF · 1.1 MB', Download]].map(([title, meta, Icon]) => { const ItemIcon = Icon as typeof FileText; return <div className="material-row" key={String(title)}><span><ItemIcon size={18} /></span><div><strong>{String(title)}</strong><small>{String(meta)}</small></div><button type="button">Open</button></div>; })}</article>
  </>;
}

function Schedule() {
  const weekdays = ['Sunday 30', 'Monday 31', 'Tuesday 01', 'Wednesday 02', 'Thursday 03'];
  return <><PageTitle eyebrow="ACADEMIC WEEK 06" title="Your week, at a glance" description="Classes, study sessions, exams and deadlines in one ruled timetable." action={<button className="secondary-button" type="button"><Download size={16} /> Export .ics</button>} />
    <article className="ledger-card calendar-panel"><div className="calendar-head"><span>GMT+3</span>{weekdays.map((day) => <strong key={day}>{day}</strong>)}</div>{['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((time, row) => <div className="calendar-row" key={time}><span>{time}</span>{weekdays.map((day, col) => { const matches = (row === 0 && col === 1) || (row === 1 && col === 2) || (row === 2 && col === 0) || (row === 4 && col === 3); return <div key={day}>{matches && <button className={row === 4 ? 'calendar-event amber' : 'calendar-event'} type="button"><strong>{row === 4 ? 'Study room' : row === 2 ? 'Discrete Math' : 'DSA class'}</strong><small>{row === 4 ? 'Library Pod 3' : 'Main campus'}</small></button>}</div>; })}</div>)}</article>
    <div className="deadline-strip"><article><span className="deadline-date">SEP<br /><strong>03</strong></span><div><span className="eyebrow">UPCOMING DEADLINE</span><h3>Graph theory problem set</h3><p>Discrete Mathematics · due at 23:59</p></div><span className="warning-pill">5 DAYS</span></article><article><span className="deadline-date exam">SEP<br /><strong>08</strong></span><div><span className="eyebrow">EXAM</span><h3>Operating Systems quiz</h3><p>Lab 2 · 10:00–10:45</p></div><span className="warning-pill">10 DAYS</span></article></div>
  </>;
}

function Rooms({ bookedRoom, onBook }: { bookedRoom: number | null; onBook: (id: number | null) => void }) {
  return <><PageTitle eyebrow="STUDY ROOMS" title="Find a place to work" description="Book a campus space or join a virtual room with your classmates." action={<button className="secondary-button" type="button"><Search size={16} /> Find a time</button>} />
    {bookedRoom && <div className="success-banner"><Check size={18} /><div><strong>Room booked.</strong><span>Your booking was added to My bookings and your schedule.</span></div><button type="button" onClick={() => onBook(null)}>Undo</button></div>}
    <div className="room-grid">{rooms.map((room) => <article className="room-card ledger-card" key={room.id}><div className="room-visual"><DoorOpen size={28} /><span className={`room-status ${room.tone}`}>{room.tone === 'available' ? 'AVAILABLE' : 'SOON'}</span></div><span className="eyebrow">{room.type}</span><h2>{room.name}</h2><p>{room.meta}</p><div className="room-time"><Clock3 size={15} />{room.availability}</div><button className={bookedRoom === room.id ? 'secondary-button booked' : 'primary-button'} type="button" onClick={() => onBook(bookedRoom === room.id ? null : room.id)}>{bookedRoom === room.id ? <><Check size={16} /> Booked</> : 'Book room'}</button></article>)}</div>
    <article className="ledger-card booking-panel"><div className="section-head"><div><span className="eyebrow">MY BOOKINGS</span><h2>Coming up</h2></div></div><div className="empty-inline"><CalendarDays size={25} /><div><strong>{bookedRoom ? 'One booking this week' : 'No rooms booked yet'}</strong><span>{bookedRoom ? 'Tuesday · 14:30–15:30 · added to schedule' : 'Your confirmed study rooms will appear here.'}</span></div></div></article>
  </>;
}

function Community({ posts, postText, setPostText, submitPost }: { posts: { author: string; role: string; initials: string; time: string; text: string; pinned: boolean }[]; postText: string; setPostText: (value: string) => void; submitPost: (event: FormEvent) => void }) {
  return <><PageTitle eyebrow="SECTION A COMMUNITY" title="Your classmates, all together" description="A private course feed visible only to verified members of your section." />
    <div className="community-grid"><section><form className="compose-card ledger-card" onSubmit={submitPost}><span className="avatar">LM</span><label><span className="sr-only">Write a post</span><textarea value={postText} onChange={(event) => setPostText(event.target.value)} placeholder="Share an update or ask your course a question…" /></label><button className="primary-button" type="submit" disabled={!postText.trim()}><Send size={15} /> Post</button></form>{posts.map((post, index) => <article className={post.pinned ? 'post-card ledger-card pinned' : 'post-card ledger-card'} key={`${post.time}-${index}`}>{post.pinned && <span className="pin-label">📌 PINNED ANNOUNCEMENT</span>}<div className="post-head"><span className="avatar">{post.initials}</span><div><strong>{post.author}</strong><small>{post.role} · {post.time}</small></div><button type="button" aria-label="Post options"><MoreHorizontal size={18} /></button></div><p>{post.text}</p><div className="post-actions"><button type="button">♡ Helpful <span>{index === 0 ? 12 : 4}</span></button><button type="button">💬 Reply <span>{index === 0 ? 3 : 6}</span></button></div></article>)}</section><aside className="ledger-card course-members"><span className="eyebrow">COURSE MEMBERS</span><h2>Who’s here</h2>{people.slice(0, 4).map(([initials, name, role]) => <div className="member-mini" key={name}><span className="avatar">{initials}</span><div><strong>{name}</strong><small>{role}</small></div><i /></div>)}<button className="card-link" type="button">View all 47 members →</button></aside></div>
  </>;
}

function Manage({ code, status, setStatus, changeCode }: { code: string; status: 'active' | 'paused' | 'invalid'; setStatus: (value: 'active' | 'paused' | 'invalid') => void; changeCode: () => void }) {
  return <><PageTitle eyebrow="REPRESENTATIVE WORKSPACE" title="Manage Software Engineering" description="Keep Section A’s people, access and course health in one accountable place." action={<button className="primary-button" type="button"><Plus size={17} /> Add content</button>} />
    <section className="manage-grid"><article className="ledger-card code-manager"><div className="section-head"><div><span className="eyebrow">STUDENT ACCESS</span><h2>Student join code</h2></div><span className={`large-status ${status}`}><i />{status.toUpperCase()}</span></div><div className={`code-stamp large ${status}`}>{code}</div><p>Share this with verified students in Software Engineering · Year 2 · Section A.</p><div className="button-row"><button className="secondary-button" type="button"><Copy size={15} /> Copy</button><button className="secondary-button" type="button" onClick={() => setStatus(status === 'paused' ? 'active' : 'paused')}><Pause size={15} />{status === 'paused' ? 'Reactivate' : 'Pause joins'}</button><button className="secondary-button" type="button" onClick={changeCode}><RefreshCw size={15} /> Regenerate</button></div><div className="audit-note"><ShieldCheck size={16} /><span>Last changed by Layla · 18 Aug 2026 · previous codes remain in the audit log</span></div></article><article className="ledger-card health-card"><span className="eyebrow">COURSE HEALTH</span><div className="health-score"><strong>91</strong><span>/100<br />Excellent</span></div>{[['Average attendance', '91%', 91], ['Lecture completion', '84%', 84], ['Weekly engagement', '76%', 76]].map(([label, value, width]) => <div className="health-row" key={String(label)}><div><span>{label}</span><strong>{value}</strong></div><div><i style={{ width: `${width}%` }} /></div></div>)}</article></section>
    <article className="ledger-card roster-panel"><div className="section-head"><div><span className="eyebrow">47 VERIFIED MEMBERS</span><h2>Course roster</h2></div><div className="roster-actions"><label><Search size={15} /><input placeholder="Search members" /></label><button className="secondary-button" type="button"><Download size={15} /> Export</button></div></div><div className="roster-table"><div className="roster-table-head"><span>Member</span><span>Role</span><span>Attendance</span><span>Last active</span><span /></div>{people.map(([initials, name, role, attendance, last]) => <div className="roster-line" key={name}><span className="person-cell"><i className="avatar">{initials}</i><strong>{name}</strong></span><span className={role === 'Representative' ? 'role-pill rep' : 'role-pill'}>{role}</span><strong>{attendance}</strong><span>{last}</span><button type="button" aria-label={`More options for ${name}`}><MoreHorizontal size={17} /></button></div>)}</div></article>
  </>;
}

function Profile() {
  return <><PageTitle eyebrow="VERIFIED CAMPUS IDENTITY" title="Layla Mansour" description="Your profile is visible only to course-mates and representatives in courses you join." action={<button className="secondary-button" type="button">Edit profile</button>} />
    <div className="profile-grid"><article className="ledger-card identity-card"><div className="profile-avatar">LM<span><Check size={13} /></span></div><h2>Layla Mansour</h2><p>Software Engineering student and Section A representative.</p><div className="verified-line"><ShieldCheck size={17} /> Identity and institution verified</div><dl><div><dt>University</dt><dd>Baghdad Technical University</dd></div><div><dt>College</dt><dd>College of Computing</dd></div><div><dt>Stage & field</dt><dd>Year 2 · Software Engineering</dd></div><div><dt>Member since</dt><dd>September 2025</dd></div></dl></article><article className="ledger-card progress-card"><span className="eyebrow">PROGRESS ACROSS COURSES</span><h2>Academic snapshot</h2>{subjects.slice(0, 3).map((subject, index) => <div className="course-progress" key={subject.code}><span className={`subject-monogram ${subject.color}`}>{subject.icon}</span><div><strong>{subject.name}</strong><small>{subject.code} · {index === 0 ? 'Representative' : 'Student'}</small><div className="subject-progress"><span style={{ width: `${[92, 84, 71][index]}%` }} /></div></div><strong>{[92, 84, 71][index]}%</strong></div>)}</article></div>
  </>;
}

function SettingsPage({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) {
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  return <><PageTitle eyebrow="ACCOUNT PREFERENCES" title="Settings" description="Control your account, notifications, privacy and appearance." />
    <div className="settings-grid"><article className="ledger-card settings-section"><span className="eyebrow">APPEARANCE</span><h2>Make the ledger yours</h2><div className="setting-line"><div><strong>Dark mode</strong><span>Use the low-light course ledger theme.</span></div><button className={dark ? 'switch on' : 'switch'} type="button" onClick={() => setDark(!dark)} aria-pressed={dark}><i /></button></div><div className="setting-line"><div><strong>Interface language</strong><span>English · العربية supported</span></div><button className="secondary-button" type="button">English <ChevronDown size={14} /></button></div></article><article className="ledger-card settings-section"><span className="eyebrow">NOTIFICATIONS</span><h2>Stay on track</h2><div className="setting-line"><div><strong>Course announcements</strong><span>Important posts from representatives.</span></div><button className={notifications ? 'switch on' : 'switch'} type="button" onClick={() => setNotifications(!notifications)} aria-pressed={notifications}><i /></button></div><div className="setting-line"><div><strong>Schedule reminders</strong><span>Alerts 30 minutes before class.</span></div><button className={reminders ? 'switch on' : 'switch'} type="button" onClick={() => setReminders(!reminders)} aria-pressed={reminders}><i /></button></div></article><article className="ledger-card settings-section privacy-card"><span className="eyebrow">PRIVACY</span><h2>Your real identity, protected</h2><p>Only verified members of your courses can see your profile photo and academic details. Your information is never public.</p><button className="secondary-button" type="button">Review visibility</button><button className="danger-link" type="button">Request account deletion</button></article></div>
  </>;
}

function Landing({ onJoin, onExplore }: { onJoin: () => void; onExplore: () => void }) {
  return <div className="landing-page"><section className="landing-hero"><div><span className="eyebrow">BUILT BY STUDENTS · TRUSTED BY CLASSMATES</span><h1>Your course, organized by the person who’s actually in it.</h1><p>Campus Hub turns real student representatives into the organizing force behind lectures, schedules, rooms and course progress.</p><div className="button-row"><button className="primary-button large-button" type="button" onClick={onJoin}>Join Campus Hub →</button><button className="secondary-button large-button" type="button" onClick={onExplore}>Explore the live demo</button></div><div className="trust-row"><span><ShieldCheck size={17} /> Verified identities</span><span><Users size={17} /> Course-only community</span><span><ClipboardCheck size={17} /> Accountable representatives</span></div></div><div className="hero-ledger"><span className="tape">SECTION A</span><div className="hero-ledger-head"><span className="brand-stamp">CH</span><strong>Course ledger</strong><small>Spring 2026</small></div>{[['Attendance', '92%'], ['Lectures', '14 / 16'], ['Next class', 'Tue · 10:00']].map(([label, value]) => <div className="hero-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}<div className="code-stamp large">DSA2-K7Q1</div></div></section><section className="how-grid"><article><span>01</span><GraduationCap size={24} /><h2>Join your real course</h2><p>Use the code from your representative and verify your academic identity.</p></article><article><span>02</span><BookOpen size={24} /><h2>Find everything in order</h2><p>Lectures, schedules, materials and rooms live in one clean course ledger.</p></article><article><span>03</span><Users size={24} /><h2>Move together</h2><p>Ask classmates, track progress and never miss a representative update.</p></article></section></div>;
}

function Join({ role, setRole, code, setCode, onSuccess }: { role: 'student' | 'representative'; setRole: (role: 'student' | 'representative') => void; code: string; setCode: (value: string) => void; onSuccess: () => void }) {
  const valid = code.toUpperCase() === 'DSA2-K7Q1' || code.toUpperCase() === 'REP-SE2-4MK';
  return <><PageTitle eyebrow="JOIN CAMPUS HUB" title="Start with your course" description="Choose your path, verify your identity and step into an organized academic year." />
    <div className="join-layout"><section className="ledger-card join-form"><span className="step-label">STEP 1 OF 3</span><h2>How are you joining?</h2><div className="role-choice"><button className={role === 'student' ? 'active' : ''} type="button" onClick={() => setRole('student')}><UserRound size={23} /><span><strong>I’m a student</strong><small>I have a student course code</small></span><i /></button><button className={role === 'representative' ? 'active' : ''} type="button" onClick={() => setRole('representative')}><Users size={23} /><span><strong>I represent a course</strong><small>I have a representative code</small></span><i /></button></div><label className="field-label">{role === 'student' ? 'Student course code' : 'Representative code'}<div className={code && valid ? 'code-input valid' : 'code-input'}><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder={role === 'student' ? 'Try DSA2-K7Q1' : 'Try REP-SE2-4MK'} /><span>{code && valid ? <Check size={18} /> : <Search size={18} />}</span></div></label>{code && <p className={valid ? 'validation success' : 'validation'}>{valid ? '✓ Active code · Software Engineering · Year 2 · Section A' : 'This code is not active. Check the stamp and try again.'}</p>}<button className="primary-button join-continue" type="button" disabled={!valid} onClick={onSuccess}>Continue with verified course →</button><p className="form-note"><ShieldCheck size={15} /> Your identity and institution details are visible only to verified course members.</p></section><aside className="join-aside"><span className="eyebrow">WHAT HAPPENS NEXT</span>{[['Verify your identity', 'Use your real name, institutional email and a real profile photo.'], ['Confirm your institution', 'Choose university, college, stage and field from a structured list.'], ['Enter your dashboard', 'You’ll be signed in and enrolled in the course immediately.']].map(([title, text], index) => <div className="join-step" key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</aside></div>
  </>;
}

function ApplicationPage({ kind }: { kind: string }) {
  const labels: Record<string, { title: string; icon: typeof BriefcaseBusiness; description: string }> = {
    work: { title: 'Apply to work', icon: BriefcaseBusiness, description: 'Find student-friendly opportunities shared with the Campus Hub community.' },
    scholarship: { title: 'Scholarships', icon: GraduationCap, description: 'Track verified funding opportunities and submit one organized application.' },
    volunteer: { title: 'Volunteer', icon: HeartHandshake, description: 'Give your skills to campus projects that need student energy.' },
    donate: { title: 'Support Campus Hub', icon: Gift, description: 'Help us keep student-led course organization free and accessible.' },
  };
  const data = labels[kind] || labels.work; const Icon = data.icon;
  return <><PageTitle eyebrow="CAMPUS OPPORTUNITIES" title={data.title} description={data.description} />
    <div className="application-layout"><section className="ledger-card opportunity-card"><span className="opportunity-icon"><Icon size={26} /></span><span className="eyebrow">FEATURED · VERIFIED</span><h2>{kind === 'scholarship' ? 'Future Engineers Grant 2026' : kind === 'volunteer' ? 'Peer Tutoring Week' : kind === 'donate' ? 'Keep the student library open' : 'Junior Product Assistant'}</h2><p>{kind === 'donate' ? 'Your support funds secure storage, accessibility work and free access for every verified student.' : 'Open to verified Campus Hub students. Applications are reviewed on a rolling basis.'}</p><div className="opportunity-meta"><span><Clock3 size={15} /> Deadline: 14 Sep</span><span><MapPin size={15} /> Baghdad · Hybrid</span></div><button className="primary-button" type="button">Start application →</button></section><aside className="ledger-card status-tracker"><span className="eyebrow">MY APPLICATIONS</span><h2>Status tracker</h2><div className="empty-inline"><FileText size={24} /><div><strong>No active applications</strong><span>Started and submitted applications will appear here.</span></div></div></aside></div>
  </>;
}
