'use client';

import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CampusState } from '@/lib/campus-db';

export default function AdminPanel() {
  const [state, setState] = useState<CampusState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetch('/api/campus', { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as CampusState & {
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        setState(result);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : 'Could not load admin data.',
        ),
      );
  }, []);
  if (error)
    return <AdminMessage title="Admin service unavailable" text={error} />;
  if (!state)
    return (
      <AdminMessage
        title="Opening administration"
        text="Checking your account permissions…"
      />
    );
  if (!state.viewer)
    return (
      <AdminMessage
        title="Administrator sign-in required"
        text="Sign in with an administrator account to continue."
        action={<Link href="/signin">Sign in</Link>}
      />
    );
  if (state.viewer.role !== 'admin')
    return (
      <AdminMessage
        title="Administrator access only"
        text="Representatives manage their courses directly inside each course page. This system panel is reserved for platform administrators."
        action={<Link href="/app">Return to workspace</Link>}
      />
    );
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="marketing-logo inverse" href="/">
          <span>CH</span>Campus Hub
        </Link>
        <nav>
          <a className="active" href="#overview">
            <LayoutDashboard size={17} />
            Overview
          </a>
          <a href="#members">
            <Users size={17} />
            Accounts
          </a>
          <a href="#courses">
            <BookOpen size={17} />
            Courses
          </a>
        </nav>
        <div className="admin-identity">
          <span>{state.viewer.initials}</span>
          <div>
            <strong>{state.viewer.fullName}</strong>
            <small>Platform administrator</small>
          </div>
        </div>
      </aside>
      <section className="admin-main">
        <header>
          <div>
            <span className="marketing-kicker">PLATFORM ADMINISTRATION</span>
            <h1>Campus Hub overview</h1>
            <p>System-level visibility across accounts, courses and access.</p>
          </div>
          <Link className="admin-secondary" href="/app">
            Open workspace
          </Link>
        </header>
        <div className="admin-metrics" id="overview">
          <article>
            <Users />
            <span>Verified members</span>
            <strong>{state.members.length}</strong>
            <small>Across the active course</small>
          </article>
          <article>
            <BookOpen />
            <span>Subjects</span>
            <strong>{state.subjects.length}</strong>
            <small>{state.lectures.length} published lectures</small>
          </article>
          <article>
            <ShieldCheck />
            <span>Join-code uses</span>
            <strong>{state.joinCode.uses}</strong>
            <small>Status: {state.joinCode.status}</small>
          </article>
        </div>
        <section className="admin-table-card" id="members">
          <div>
            <span className="marketing-kicker">ACCOUNT DIRECTORY</span>
            <h2>Verified course accounts</h2>
          </div>
          <div className="admin-table">
            <div className="admin-table-head">
              <span>Member</span>
              <span>Role</span>
              <span>Attendance</span>
            </div>
            {state.members.map((member) => (
              <div key={member.name}>
                <span>
                  <i>{member.initials}</i>
                  <strong>{member.name}</strong>
                </span>
                <b>{member.role}</b>
                <span>{member.attendance}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-table-card" id="courses">
          <div>
            <span className="marketing-kicker">COURSE CATALOG</span>
            <h2>{state.course.name}</h2>
            <p>
              {state.course.institution} · {state.course.yearLabel} ·{' '}
              {state.course.sectionLabel}
            </p>
          </div>
          <div className="admin-subject-list">
            {state.subjects.map((subject) => (
              <article key={subject.id}>
                <span>{subject.icon}</span>
                <div>
                  <strong>{subject.name}</strong>
                  <small>
                    {subject.code} · {subject.lectures} lectures
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
        <Link className="admin-signout" href="/app">
          <LogOut size={15} />
          Account controls are available in the workspace
        </Link>
      </section>
    </main>
  );
}

function AdminMessage({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <main className="admin-message">
      <Link className="marketing-logo" href="/">
        <span>CH</span>Campus Hub
      </Link>
      <div>
        <ShieldCheck size={34} />
        <h1>{title}</h1>
        <p>{text}</p>
        {action}
      </div>
    </main>
  );
}
