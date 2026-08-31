'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  FilePenLine,
  GraduationCap,
  Layers3,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AcademicShell from '@/components/academic-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CampusState } from '@/lib/campus-db';

type PortalMode = 'directory' | 'detail' | 'add-lecture';

export default function SubjectsPortal({ mode }: { mode: PortalMode }) {
  const [state, setState] = useState<CampusState | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [lectureId, setLectureId] = useState('');
  const [method, setMethod] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const subjectsIndex = parts.indexOf('subjects');
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() => {
      setSubjectId(subjectsIndex >= 0 ? (parts[subjectsIndex + 1] ?? '') : '');
      setLectureId(params.get('lecture') ?? '');
      setMethod(params.get('method') ?? '');
    });
    void fetch('/api/campus', { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as CampusState & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error || 'Unable to load subjects.');
        if (!result.viewer) {
          window.location.assign('/signin');
          return;
        }
        setState(result);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error ? caught.message : 'Unable to load subjects.',
        ),
      );
  }, []);

  if (!state)
    return (
      <AcademicShell>
        <section className="portal-state">
          <span className="portal-loader" />
          <h1>{error || 'Opening your subjects'}</h1>
          <p>
            {error
              ? 'Return to the workspace and try again.'
              : 'Preparing lectures, degrees, and analytics…'}
          </p>
        </section>
      </AcademicShell>
    );

  const shellProps = {
    courseName: state.course.name,
    courseMeta: `${state.course.yearLabel} · ${state.course.sectionLabel}`,
    viewerInitials: state.viewer?.initials ?? 'CH',
  };
  const subject = state.subjects.find((item) => item.id === subjectId);

  if (mode !== 'directory' && !subject)
    return (
      <AcademicShell {...shellProps}>
        <section className="portal-state">
          <BookOpen size={30} />
          <h1>Subject not found</h1>
          <p>
            This subject may have been removed or the link may be incorrect.
          </p>
          <a href="/app/subjects">Return to subjects</a>
        </section>
      </AcademicShell>
    );

  if (mode === 'add-lecture')
    return (
      <AcademicShell {...shellProps}>
        <LectureMethodPage
          state={state}
          subject={subject!}
          selectedMethod={method}
        />
      </AcademicShell>
    );

  return (
    <AcademicShell {...shellProps}>
      {mode === 'directory' ? (
        <SubjectsDirectory state={state} />
      ) : (
        <SubjectDetail
          state={state}
          subject={subject!}
          selectedLectureId={lectureId}
        />
      )}
    </AcademicShell>
  );
}

function SubjectsDirectory({ state }: { state: CampusState }) {
  return (
    <section className="subjects-portal">
      <PortalHeading
        kicker="LEARNING LIBRARY"
        title="Subjects"
        text="Move from course overview to individual lectures, grades, and performance signals."
        meta={`${state.subjects.length} active subjects`}
      />
      <Tabs defaultValue="subjects" className="portal-tabs">
        <TabsList className="portal-tab-list" aria-label="Subjects views">
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="degrees">Degrees</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="subjects">
          <div className="portal-section-head">
            <div>
              <h2>Your semester</h2>
              <p>Open a subject to view its lectures and learning record.</p>
            </div>
            {(state.viewer?.role === 'representative' ||
              state.viewer?.role === 'admin') && (
              <a className="portal-primary" href="/app/manage/subject?mode=new">
                <Plus size={17} /> Add subject
              </a>
            )}
          </div>
          <div className="portal-subject-grid">
            {state.subjects.map((subject, index) => {
              const progress = subject.lectures
                ? Math.round((subject.viewed / subject.lectures) * 100)
                : 0;
              return (
                <a
                  className={`portal-subject-card tone-${(index % 4) + 1}`}
                  href={`/app/subjects/${encodeURIComponent(subject.id)}`}
                  key={subject.id}
                  aria-label={`Open ${subject.name}`}
                >
                  <div className="portal-subject-card-top">
                    <span>{subject.icon}</span>
                    <small>{subject.code}</small>
                  </div>
                  <div>
                    <h2>{subject.name}</h2>
                    <p>Next: {subject.next}</p>
                  </div>
                  <div className="portal-card-progress">
                    <div>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <small>{progress}% complete</small>
                  </div>
                  <footer>
                    <span>{subject.lectures} lectures</span>
                    <strong>
                      Open subject <ArrowRight size={15} />
                    </strong>
                  </footer>
                </a>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="degrees">
          <DegreesOverview state={state} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsOverview state={state} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function SubjectDetail({
  state,
  subject,
  selectedLectureId,
}: {
  state: CampusState;
  subject: CampusState['subjects'][number];
  selectedLectureId: string;
}) {
  const lectures = state.lectures.filter(
    (item) => item.subjectId === subject.id,
  );
  const selectedLecture = lectures.find(
    (item) => item.id === selectedLectureId,
  );
  return (
    <section className="subjects-portal subject-detail-portal">
      <a className="portal-back" href="/app/subjects">
        <ArrowLeft size={15} /> All subjects
      </a>
      <PortalHeading
        kicker={subject.code}
        title={subject.name}
        text={`Next focus: ${subject.next}`}
        meta={`${subject.viewed} of ${subject.lectures} lectures completed`}
      />
      <Tabs defaultValue="lectures" className="portal-tabs">
        <TabsList
          className="portal-tab-list"
          aria-label={`${subject.name} views`}
        >
          <TabsTrigger value="lectures">Lectures</TabsTrigger>
          <TabsTrigger value="degrees">Degrees</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="lectures">
          <div className="portal-section-head">
            <div>
              <h2>Lecture library</h2>
              <p>Open a lecture card to view its summary and learning link.</p>
            </div>
            <a
              className="portal-primary"
              href={`/app/subjects/${encodeURIComponent(subject.id)}/add-lecture`}
            >
              <Plus size={17} /> Add lecture
            </a>
          </div>
          {selectedLecture && (
            <article className="selected-lecture-panel" id="selected-lecture">
              <span>
                <Sparkles size={18} /> LECTURE{' '}
                {String(selectedLecture.position).padStart(2, '0')}
              </span>
              <div>
                <h2>{selectedLecture.title}</h2>
                <p>{selectedLecture.summary}</p>
              </div>
              <a href="#lecture-list">Return to list</a>
            </article>
          )}
          <div className="lecture-card-list" id="lecture-list">
            {lectures.map((lecture) => (
              <a
                className={
                  lecture.id === selectedLectureId
                    ? 'lecture-link-card selected'
                    : 'lecture-link-card'
                }
                href={`/app/subjects/${encodeURIComponent(subject.id)}/lectures/${encodeURIComponent(lecture.id)}`}
                key={lecture.id}
              >
                <span className="lecture-number">
                  {String(lecture.position).padStart(2, '0')}
                </span>
                <div>
                  <div className="lecture-card-label">
                    {lecture.completed ? (
                      <>
                        <Check size={13} /> Completed
                      </>
                    ) : (
                      <>
                        <Clock3 size={13} /> Ready to learn
                      </>
                    )}
                  </div>
                  <h3>{lecture.title}</h3>
                  <p>{lecture.summary}</p>
                </div>
                <span className="lecture-open">
                  Open lecture <ChevronRight size={17} />
                </span>
              </a>
            ))}
            {!lectures.length && (
              <div className="portal-empty">
                <BookOpen />
                <h2>No lectures yet</h2>
                <p>The course representative can add the first lecture.</p>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="degrees">
          <SubjectDegrees subject={subject} lectures={lectures} />
        </TabsContent>
        <TabsContent value="analytics">
          <SubjectAnalytics subject={subject} lectures={lectures} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function LectureMethodPage({
  state,
  subject,
  selectedMethod,
}: {
  state: CampusState;
  subject: CampusState['subjects'][number];
  selectedMethod: string;
}) {
  const canManage =
    state.viewer?.role === 'representative' || state.viewer?.role === 'admin';
  const methods = [
    {
      key: 'website-ai',
      icon: BrainCircuit,
      title: 'Make a lecture with website AI',
      text: 'Turn your topic, outcomes, and source notes into a structured lecture draft.',
      label: 'Website AI',
    },
    {
      key: 'ai-agents',
      icon: Bot,
      title: 'Make a lecture with AI agents',
      text: 'Let specialized agents research, outline, review, and prepare the lecture together.',
      label: 'AI agents',
      recommended: true,
    },
    {
      key: 'manual',
      icon: FilePenLine,
      title: 'Make a lecture manually',
      text: 'Write the lecture title, summary, content, resources, and publishing details yourself.',
      label: 'Manual editor',
    },
  ];
  const selected = methods.find((item) => item.key === selectedMethod);
  return (
    <section className="lecture-method-page">
      <a
        className="portal-back"
        href={`/app/subjects/${encodeURIComponent(subject.id)}`}
      >
        <ArrowLeft size={15} /> {subject.name}
      </a>
      <div className="lecture-method-hero">
        <span className="lecture-method-icon">
          <Layers3 size={25} />
        </span>
        <span className="portal-kicker">NEW LECTURE · {subject.code}</span>
        <h1>How do you want to build this lecture?</h1>
        <p>
          {canManage
            ? 'Choose a creation workflow. You can return here and select another method at any time.'
            : 'Explore the available creation workflows. Publishing remains limited to course representatives.'}
        </p>
      </div>
      {selected && (
        <div className="method-selection-note">
          <Check size={18} />
          <div>
            <strong>{selected.label} selected</strong>
            <span>
              This destination is reserved for the next build phase; the
              creation workflow has not been added yet.
            </span>
          </div>
        </div>
      )}
      <div className="lecture-method-grid">
        {methods.map(({ key, icon: Icon, title, text, recommended }) => (
          <a
            className={
              recommended
                ? 'lecture-method-card recommended'
                : 'lecture-method-card'
            }
            href={
              key === 'ai-agents'
                ? `/app/subjects/${encodeURIComponent(subject.id)}/add-lecture/ai-agents`
                : `/app/subjects/${encodeURIComponent(subject.id)}/add-lecture?method=${key}`
            }
            key={key}
          >
            {recommended && (
              <span className="recommended-badge">
                <Sparkles size={13} /> Recommended
              </span>
            )}
            <span className="method-icon">
              <Icon size={25} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
            <strong>
              Choose this method <ArrowRight size={16} />
            </strong>
          </a>
        ))}
      </div>
      <div className="lecture-method-footnote">
        <CircleGauge size={17} />
        <span>
          No lecture is published until a representative reviews and approves
          it.
        </span>
      </div>
    </section>
  );
}

function PortalHeading({
  kicker,
  title,
  text,
  meta,
}: {
  kicker: string;
  title: string;
  text: string;
  meta: string;
}) {
  return (
    <header className="portal-heading">
      <div>
        <span className="portal-kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <span className="portal-meta">
        <Layers3 size={15} /> {meta}
      </span>
    </header>
  );
}

function DegreesOverview({ state }: { state: CampusState }) {
  const average = state.subjects.length
    ? Math.round(
        state.subjects.reduce(
          (sum, item) =>
            sum + (item.lectures ? (item.viewed / item.lectures) * 100 : 0),
          0,
        ) / state.subjects.length,
      )
    : 0;
  return (
    <section className="portal-data-view">
      <div className="portal-summary-grid">
        <Summary
          icon={GraduationCap}
          label="Current average"
          value={`${average}%`}
          note="Based on completed course work"
        />
        <Summary
          icon={TrendingUp}
          label="Strongest subject"
          value={state.subjects[0]?.code ?? '—'}
          note="Highest completion this term"
        />
        <Summary
          icon={Clock3}
          label="Pending results"
          value="2"
          note="Awaiting representative review"
        />
      </div>
      <article className="portal-table-card">
        <header>
          <h2>Subject degrees</h2>
          <p>A clear overview of learning progress by subject.</p>
        </header>
        {state.subjects.map((subject) => {
          const score = subject.lectures
            ? Math.round((subject.viewed / subject.lectures) * 100)
            : 0;
          return (
            <div className="portal-table-row" key={subject.id}>
              <span className="mini-subject-mark">{subject.icon}</span>
              <div>
                <strong>{subject.name}</strong>
                <small>{subject.code}</small>
              </div>
              <span>
                {score >= 90
                  ? 'Excellent'
                  : score >= 70
                    ? 'Good'
                    : 'In progress'}
              </span>
              <strong>{score}%</strong>
            </div>
          );
        })}
      </article>
    </section>
  );
}

function AnalyticsOverview({ state }: { state: CampusState }) {
  return (
    <section className="portal-data-view">
      <div className="portal-summary-grid">
        <Summary
          icon={BarChart3}
          label="Lectures viewed"
          value={`${state.subjects.reduce((sum, item) => sum + item.viewed, 0)}`}
          note="Across all active subjects"
        />
        <Summary
          icon={BookOpen}
          label="Course library"
          value={`${state.lectures.length}`}
          note="Published lectures"
        />
        <Summary
          icon={TrendingUp}
          label="Weekly momentum"
          value="+12%"
          note="Compared with last week"
        />
      </div>
      <article className="analytics-bars">
        <header>
          <h2>Completion by subject</h2>
          <p>Where your learning time is producing the most progress.</p>
        </header>
        {state.subjects.map((subject) => {
          const progress = subject.lectures
            ? Math.round((subject.viewed / subject.lectures) * 100)
            : 0;
          return (
            <div className="analytics-row" key={subject.id}>
              <span>{subject.code}</span>
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
              <strong>{progress}%</strong>
            </div>
          );
        })}
      </article>
    </section>
  );
}

function SubjectDegrees({
  subject,
  lectures,
}: {
  subject: CampusState['subjects'][number];
  lectures: CampusState['lectures'];
}) {
  const score = subject.lectures
    ? Math.round((subject.viewed / subject.lectures) * 100)
    : 0;
  return (
    <section className="portal-data-view">
      <div className="portal-summary-grid">
        <Summary
          icon={GraduationCap}
          label="Current degree"
          value={`${score}%`}
          note="Completion-based course estimate"
        />
        <Summary
          icon={Check}
          label="Completed"
          value={`${lectures.filter((item) => item.completed).length}`}
          note={`${lectures.length} published lectures`}
        />
        <Summary
          icon={TrendingUp}
          label="Trend"
          value="On track"
          note="Consistent learning activity"
        />
      </div>
      <article className="portal-table-card">
        <header>
          <h2>Degree components</h2>
          <p>Your subject assessment record will appear here.</p>
        </header>
        {['Coursework', 'Quizzes', 'Attendance'].map((label, index) => (
          <div className="portal-table-row simple" key={label}>
            <span>{label}</span>
            <span>{index === 0 ? 'Recorded' : 'In progress'}</span>
            <strong>{Math.max(score - index * 4, 0)}%</strong>
          </div>
        ))}
      </article>
    </section>
  );
}

function SubjectAnalytics({
  subject,
  lectures,
}: {
  subject: CampusState['subjects'][number];
  lectures: CampusState['lectures'];
}) {
  const progress = subject.lectures
    ? Math.round((subject.viewed / subject.lectures) * 100)
    : 0;
  return (
    <section className="portal-data-view">
      <div className="portal-summary-grid">
        <Summary
          icon={BarChart3}
          label="Completion"
          value={`${progress}%`}
          note="Published lecture progress"
        />
        <Summary
          icon={Clock3}
          label="Learning time"
          value="6.4h"
          note="Estimated this semester"
        />
        <Summary
          icon={TrendingUp}
          label="Activity"
          value="High"
          note="Active across the last 7 days"
        />
      </div>
      <article className="analytics-bars">
        <header>
          <h2>Lecture activity</h2>
          <p>Completion status throughout the subject.</p>
        </header>
        {lectures.map((lecture) => (
          <div className="analytics-row" key={lecture.id}>
            <span>{String(lecture.position).padStart(2, '0')}</span>
            <div>
              <i style={{ width: lecture.completed ? '100%' : '24%' }} />
            </div>
            <strong>{lecture.completed ? 'Done' : 'Next'}</strong>
          </div>
        ))}
      </article>
    </section>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="portal-summary-card">
      <span>
        <Icon size={18} />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}
