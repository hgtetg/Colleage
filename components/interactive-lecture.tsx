'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Compass,
  Lightbulb,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AcademicShell from '@/components/academic-shell';
import type { CampusState } from '@/lib/campus-db';

type LessonSection = {
  title: string;
  body: string;
  image:
    | number
    | {
        title: string;
        caption: string;
        sourceLocation: string;
        alt?: string;
        url?: string | null;
      };
  keyPoint?: string;
};

function fallbackSections(subjectName: string, nextTopic: string, summary: string): LessonSection[] {
  return [
    {
      title: 'Start with the core idea',
      body: summary || `Begin by naming the main concept in ${subjectName} and the problem it helps solve.`,
      image: 0,
      keyPoint: 'Clear definitions give every later example a place to stand.',
    },
    {
      title: 'Trace one example',
      body: `Follow a simple example step by step. Notice how each choice changes the result and relates to ${nextTopic || 'the next class topic'}.`,
      image: 4,
      keyPoint: 'Reason through the flow before trying to remember the answer.',
    },
    {
      title: 'Use it deliberately',
      body: 'Compare two reasonable approaches, identify the trade-off, then explain why one choice fits the situation better.',
      image: 8,
      keyPoint: 'A good solution is the one that fits the constraints.',
    },
  ];
}

function lessonSections(
  content: CampusState['lectures'][number]['content'],
  subjectName: string,
  nextTopic: string,
  summary: string,
) {
  const sections = content?.sections
    ?.filter((item) => item && item.title && item.body)
    .slice(0, 6)
    .map((item, index) => ({
      title: item.title,
      body: item.body,
      image:
        Number.isInteger(item.image) && Number(item.image) >= 0 && Number(item.image) <= 8
          ? Number(item.image)
          : typeof item.image === 'object' && item.image
            ? item.image
            : index,
      keyPoint: item.keyPoint,
    }));
  return sections?.length ? sections : fallbackSections(subjectName, nextTopic, summary);
}

export default function InteractiveLecture() {
  const [state, setState] = useState<CampusState | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [lectureId, setLectureId] = useState('');
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const subjectIndex = parts.indexOf('subjects');
    const lectureIndex = parts.indexOf('lectures');
    const nextSubjectId = subjectIndex >= 0 ? (parts[subjectIndex + 1] ?? '') : '';
    const nextLectureId = lectureIndex >= 0 ? (parts[lectureIndex + 1] ?? '') : '';
    setSubjectId(nextSubjectId);
    setLectureId(nextLectureId);
    void fetch('/api/campus', { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as CampusState & { error?: string };
        if (!response.ok) throw new Error(result.error || 'Unable to load the lecture.');
        if (!result.viewer) {
          window.location.assign('/signin');
          return;
        }
        setState(result);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load the lecture.'));
  }, []);

  const subject = state?.subjects.find((item) => item.id === subjectId);
  const lecture = state?.lectures.find((item) => item.id === lectureId && item.subjectId === subjectId);
  const sections = useMemo(
    () => lessonSections(lecture?.content ?? null, subject?.name ?? 'this subject', subject?.next ?? '', lecture?.summary ?? ''),
    [lecture?.content, lecture?.summary, subject?.name, subject?.next],
  );

  useEffect(() => {
    setCompleted(Boolean(lecture?.completed));
    setActiveSection(0);
  }, [lecture?.completed, lectureId]);

  const shellProps = {
    courseName: state?.course.name,
    courseMeta: state ? `${state.course.yearLabel} · ${state.course.sectionLabel}` : undefined,
    viewerInitials: state?.viewer?.initials ?? 'CH',
  };
  if (!state)
    return (
      <AcademicShell {...shellProps}>
        <section className="portal-state"><span className="portal-loader" /><h1>{error || 'Opening your lecture'}</h1><p>{error ? 'Return to the subject and try again.' : 'Preparing the reading experience…'}</p></section>
      </AcademicShell>
    );
  if (!subject || !lecture)
    return (
      <AcademicShell {...shellProps}>
        <section className="portal-state"><BookOpenCheck size={30} /><h1>Lecture not found</h1><p>This lesson may have been removed or the link may be incorrect.</p><a href={subjectId ? `/app/subjects/${encodeURIComponent(subjectId)}` : '/app/subjects'}>Return to subjects</a></section>
      </AcademicShell>
    );

  const design = ['atelier', 'midnight', 'citrus'].includes(lecture.design) ? lecture.design : 'atelier';
  const current = sections[activeSection] ?? sections[0];
  const sourceImage = typeof current.image === 'object' ? current.image : null;
  const imageStyle = sourceImage?.url ? { backgroundImage: `url("${sourceImage.url}")` } : undefined;
  async function toggleCompletion() {
    setSaving(true);
    try {
      const response = await fetch('/api/campus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'complete_lecture', lectureId: lecture.id }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to update your progress.');
      setCompleted((value) => !value);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update your progress.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AcademicShell {...shellProps}>
      <main className={`interactive-lecture lecture-design-${design}`}>
        <a className="interactive-back" href={`/app/subjects/${encodeURIComponent(subject.id)}`}><ArrowLeft size={15} /> Back to {subject.name}</a>
        <header className="lecture-reader-hero">
          <div>
            <span className="lecture-reader-kicker"><Sparkles size={15} /> {subject.code} · Interactive lesson</span>
            <h1>{lecture.content?.title || lecture.title}</h1>
            <p>{lecture.content?.subtitle || lecture.summary}</p>
            <div className="lecture-reader-meta"><span><Clock3 size={15} /> {lecture.content?.estimatedMinutes ?? Math.max(8, sections.length * 4)} min read</span><span><Compass size={15} /> {sections.length} learning moments</span></div>
          </div>
          <button className={completed ? 'reader-complete completed' : 'reader-complete'} type="button" onClick={toggleCompletion} disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            {completed ? 'Completed' : 'Mark complete'}
          </button>
        </header>
        <div className="lecture-reading-layout">
          <nav className="lecture-section-nav" aria-label="Lecture sections">
            <small>IN THIS LESSON</small>
            {sections.map((section, index) => (
              <button type="button" className={activeSection === index ? 'active' : ''} onClick={() => setActiveSection(index)} key={section.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>{section.title}
              </button>
            ))}
          </nav>
          <article className="lecture-reader-card">
            <figure className={sourceImage ? 'lecture-reader-figure source-lecture-figure' : 'lecture-reader-figure'}>
              <div
                className={sourceImage ? 'lecture-reader-image source-lecture-image' : `lecture-reader-image image-tile-${current.image}`}
                style={imageStyle}
                role={sourceImage ? 'img' : undefined}
                aria-label={sourceImage?.alt || sourceImage?.title}
                aria-hidden={sourceImage ? undefined : true}
              ><span>{sourceImage?.title || 'Campus Hub · visual explanation'}</span></div>
              {sourceImage && <figcaption><strong>{sourceImage.title}</strong><span>{sourceImage.caption}</span></figcaption>}
            </figure>
            <div className="lecture-reader-section">
              <span>PART {String(activeSection + 1).padStart(2, '0')}</span>
              <h2>{current.title}</h2>
              <p>{current.body}</p>
              {current.keyPoint && <aside><Lightbulb size={18} /><div><strong>Keep this in mind</strong><p>{current.keyPoint}</p></div></aside>}
            </div>
            <footer className="reader-section-actions">
              <button type="button" onClick={() => setActiveSection((index) => Math.max(0, index - 1))} disabled={activeSection === 0}><ArrowLeft size={15} /> Previous</button>
              {activeSection < sections.length - 1 ? (
                <button type="button" onClick={() => setActiveSection((index) => Math.min(sections.length - 1, index + 1))}>Next moment <ArrowRight size={15} /></button>
              ) : <span><Check size={15} /> Lesson complete</span>}
            </footer>
          </article>
          <aside className="lecture-checkpoint">
            <span>QUICK CHECK</span>
            <h2>What makes this section useful?</h2>
            <p>Choose the study habit that helps you turn information into understanding.</p>
            {['Repeat the headline without context.', 'Trace the example and explain the trade-off.', 'Skip the example and memorize the last word.'].map((choice, index) => (
              <button type="button" className={answer === index ? (index === 1 ? 'correct' : 'incorrect') : ''} onClick={() => setAnswer(index)} key={choice}>{answer === index && index === 1 ? <CheckCircle2 size={16} /> : <span>{String.fromCharCode(65 + index)}</span>}{choice}</button>
            ))}
            {answer === 1 && <div className="checkpoint-success"><CheckCircle2 size={16} /> Exactly. A worked example makes the idea usable.</div>}
          </aside>
        </div>
        {error && <p className="agent-form-error reader-error">{error}</p>}
      </main>
    </AcademicShell>
  );
}
