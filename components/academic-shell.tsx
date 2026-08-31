'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  Bell,
  BookOpen,
  CalendarDays,
  DoorOpen,
  Home,
  Menu,
  MessageCircle,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { useState } from 'react';

const navigation = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    href: '/app?view=dashboard',
  },
  { key: 'subjects', label: 'Subjects', icon: BookOpen, href: '/app/subjects' },
  {
    key: 'schedule',
    label: 'Schedule',
    icon: CalendarDays,
    href: '/app?view=schedule',
  },
  {
    key: 'rooms',
    label: 'Study rooms',
    icon: DoorOpen,
    href: '/app?view=rooms',
  },
  {
    key: 'community',
    label: 'Community',
    icon: MessageCircle,
    href: '/app?view=community',
  },
];

export default function AcademicShell({
  children,
  courseName = 'Software Engineering',
  courseMeta = 'Year 2 · Section A',
  viewerInitials = 'CH',
}: {
  children: React.ReactNode;
  courseName?: string;
  courseMeta?: string;
  viewerInitials?: string;
}) {
  const [dark, setDark] = useState(false);
  return (
    <div
      className={
        dark ? 'campus-app academic-site dark' : 'campus-app academic-site'
      }
    >
      <header className="settings-bar academic-settings-bar">
        <a className="brand" href="/" aria-label="Campus Hub home">
          <span className="brand-stamp">CH</span>
          <span>Campus Hub</span>
        </a>
        <div className="academic-course-mini">
          <span>{courseName}</span>
          <small>{courseMeta}</small>
        </div>
        <div className="settings-actions">
          <button
            type="button"
            onClick={() => setDark((value) => !value)}
            aria-label="Toggle theme"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a href="/app?view=dashboard" aria-label="Notifications">
            <Bell size={17} />
          </a>
          <a href="/app?view=settings" aria-label="Settings">
            <Settings size={17} />
          </a>
          <a
            className="academic-avatar"
            href="/app?view=profile"
            aria-label="Profile"
          >
            {viewerInitials}
          </a>
          <a
            className="academic-menu"
            href="/app"
            aria-label="Open workspace menu"
          >
            <Menu size={18} />
          </a>
        </div>
      </header>

      <nav className="main-nav academic-main-nav" aria-label="Main navigation">
        <div className="nav-inner">
          {navigation.map(({ key, label, icon: Icon, href }) => (
            <a
              className={
                key === 'subjects' ? 'main-nav-item active' : 'main-nav-item'
              }
              key={key}
              href={href}
              aria-current={key === 'subjects' ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{label}</span>
            </a>
          ))}
        </div>
        <a
          className="course-switcher academic-course-switcher"
          href="/app/courses"
        >
          <span className="course-dot">SE</span>
          <span>
            <strong>{courseName}</strong>
            <small>{courseMeta}</small>
          </span>
          <BookOpen size={16} />
        </a>
      </nav>

      <main className="academic-page">{children}</main>
    </div>
  );
}
