'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import { ArrowLeft, BookOpen, Check, Settings2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CampusState } from '@/lib/campus-db';

export default function CoursesPage() {
  const [state, setState] = useState<CampusState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetch('/api/campus', { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as CampusState & {
          error?: string;
        };
        if (!response.ok) throw new Error(result.error);
        if (!result.viewer) {
          window.location.assign('/signin');
          return;
        }
        setState(result);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : 'Unable to load courses.',
        ),
      );
  }, []);
  return (
    <main className="courses-shell">
      <header>
        <a className="marketing-logo" href="/">
          <span>CH</span>Campus Hub
        </a>
        <a href="/app">
          <ArrowLeft size={16} />
          Workspace
        </a>
      </header>
      <section>
        <span className="marketing-kicker">MY COURSES</span>
        <h1>Your academic spaces</h1>
        <p>
          Open a course, review your role, or manage its content when you are
          the representative.
        </p>
        {error && <div className="auth-error">{error}</div>}
        {state && (
          <div className="course-directory">
            <article>
              <div className="course-cover">
                <BookOpen size={30} />
                <span>ACTIVE</span>
              </div>
              <div className="course-directory-copy">
                <small>{state.course.institution}</small>
                <h2>{state.course.name}</h2>
                <p>
                  {state.course.yearLabel} · {state.course.sectionLabel} ·{' '}
                  {state.course.college}
                </p>
                <div className="course-role">
                  <Users size={15} />
                  {state.viewer?.role}
                </div>
              </div>
              <div className="course-directory-actions">
                <a href="/app">
                  <Check size={16} />
                  Open course
                </a>
                {(state.viewer?.role === 'representative' ||
                  state.viewer?.role === 'admin') && (
                  <a href="/app/manage/course">
                    <Settings2 size={16} />
                    Edit course
                  </a>
                )}
              </div>
            </article>
          </div>
        )}
      </section>
    </main>
  );
}
