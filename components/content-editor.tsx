'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  DoorOpen,
  FilePlus2,
  MessageCircle,
  Plus,
  Save,
  Settings2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CampusState } from '@/lib/campus-db';

type Entity = 'course' | 'subject' | 'lecture' | 'schedule' | 'room' | 'post';
type FormState = Record<string, string>;

const entityCopy: Record<Entity, { title: string; icon: typeof BookOpen }> = {
  course: { title: 'Edit course', icon: Settings2 },
  subject: { title: 'Subject', icon: BookOpen },
  lecture: { title: 'Lecture', icon: FilePlus2 },
  schedule: { title: 'Schedule event', icon: CalendarDays },
  room: { title: 'Study room', icon: DoorOpen },
  post: { title: 'Community post', icon: MessageCircle },
};

export default function ContentEditor() {
  const [state, setState] = useState<CampusState | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [route, setRoute] = useState<{
    entity: Entity;
    id: string;
    mode: 'new' | 'edit';
    subjectId: string;
    ready: boolean;
  }>({
    entity: 'course',
    id: '',
    mode: 'edit',
    subjectId: '',
    ready: false,
  });
  const [tab, setTab] = useState<'details' | 'content'>('details');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { entity, id, mode, subjectId } = route;

  useEffect(() => {
    const value = window.location.pathname.split('/').filter(Boolean).at(-1);
    const params = new URLSearchParams(window.location.search);
    queueMicrotask(() =>
      setRoute({
        entity:
          value && value in entityCopy
            ? (value as Entity)
            : ('course' as Entity),
        id: params.get('id') ?? '',
        mode: params.get('mode') === 'new' ? 'new' : 'edit',
        subjectId: params.get('subjectId') ?? '',
        ready: true,
      }),
    );
  }, []);

  useEffect(() => {
    if (!route.ready) return;
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
        const subject = result.subjects.find((item) => item.id === id);
        const lecture = result.lectures.find((item) => item.id === id);
        const schedule = result.schedule.find((item) => item.id === id);
        const room = result.rooms.find((item) => item.id === id);
        const post = result.posts.find((item) => item.id === id);
        setForm(
          entity === 'course'
            ? {
                name: result.course.name,
                yearLabel: result.course.yearLabel,
                sectionLabel: result.course.sectionLabel,
                institution: result.course.institution,
                college: result.course.college,
                description: result.course.description,
              }
            : entity === 'subject'
              ? {
                  name: subject?.name ?? '',
                  code: subject?.code ?? '',
                  topic: subject?.next ?? '',
                }
              : entity === 'lecture'
                ? {
                    subjectId: subjectId || lecture?.subjectId || '',
                    title: lecture?.title ?? '',
                    summary: lecture?.summary ?? '',
                  }
                : entity === 'schedule'
                  ? {
                      title: schedule?.title ?? '',
                      location: schedule?.location ?? '',
                      startsAt: schedule?.startsAt.slice(0, 16) ?? '',
                      endsAt: schedule?.endsAt.slice(0, 16) ?? '',
                      type: schedule?.type ?? 'class',
                      notes: schedule?.notes ?? '',
                    }
                  : entity === 'room'
                    ? {
                        name: room?.name ?? '',
                        capacity: String(room?.capacity ?? 6),
                        type: room?.type ?? 'Physical room',
                        availability: room?.availability ?? 'Available now',
                        meetingUrl: room?.meetingUrl ?? '',
                      }
                    : { text: post?.text ?? '' },
        );
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Unable to load.'),
      )
      .finally(() => setLoading(false));
  }, [entity, id, route.ready, subjectId]);

  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const action =
      entity === 'course'
        ? 'update_course'
        : entity === 'lecture'
          ? 'add_lecture'
          : entity === 'post'
            ? 'edit_post'
            : `${mode === 'new' ? 'add' : 'edit'}_${entity}`;
    const payload: Record<string, unknown> = { action, ...form };
    if (id) payload[entity === 'post' ? 'postId' : 'id'] = id;
    if (entity === 'room') payload.capacity = Number(form.capacity);
    if (entity === 'schedule') {
      payload.startsAt = new Date(form.startsAt).toISOString();
      payload.endsAt = new Date(form.endsAt).toISOString();
    }
    try {
      const response = await fetch('/api/campus', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || 'Your changes could not be saved.');
      window.location.assign('/app');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.');
      setSaving(false);
    }
  };

  if (loading)
    return <EditorMessage title="Opening editor" text="Loading course data…" />;
  if (!state) return <EditorMessage title="Editor unavailable" text={error} />;
  const canManage =
    state.viewer?.role === 'representative' || state.viewer?.role === 'admin';
  if (!canManage)
    return (
      <EditorMessage
        title="Representative access required"
        text="Students can view course content but cannot change it."
      />
    );
  const Icon = entityCopy[entity].icon;
  const pageTitle =
    entity === 'course'
      ? 'Edit course'
      : `${mode === 'new' ? 'Add' : 'Edit'} ${entityCopy[entity].title.toLowerCase()}`;

  return (
    <main className="editor-shell">
      <header className="editor-topbar">
        <a href="/app" className="marketing-logo">
          <span>CH</span>Campus Hub
        </a>
        <a className="editor-back" href="/app">
          <ArrowLeft size={16} /> Back to workspace
        </a>
      </header>
      <section className="editor-page">
        <div className="editor-heading">
          <span className="editor-icon">
            <Icon size={22} />
          </span>
          <div>
            <span className="marketing-kicker">REPRESENTATIVE CONTROLS</span>
            <h1>{pageTitle}</h1>
            <p>Changes are saved to the live course and visible to students.</p>
          </div>
        </div>
        {entity === 'course' && (
          <div className="editor-tabs">
            <button
              className={tab === 'details' ? 'active' : ''}
              type="button"
              onClick={() => setTab('details')}
            >
              Course details
            </button>
            <button
              className={tab === 'content' ? 'active' : ''}
              type="button"
              onClick={() => setTab('content')}
            >
              Course content
            </button>
          </div>
        )}
        {entity === 'course' && tab === 'content' ? (
          <CourseContent state={state} />
        ) : (
          <form className="editor-form" onSubmit={submit}>
            <EditorFields
              entity={entity}
              form={form}
              subjects={state.subjects}
              update={update}
            />
            {error && <div className="auth-error">{error}</div>}
            <div className="editor-actions">
              <a href="/app">Cancel</a>
              <button type="submit" disabled={saving}>
                {saving ? <span className="spinner-dot" /> : <Save size={17} />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function EditorFields({
  entity,
  form,
  subjects,
  update,
}: {
  entity: Entity;
  form: FormState;
  subjects: CampusState['subjects'];
  update: (key: string, value: string) => void;
}) {
  if (entity === 'course')
    return (
      <>
        <Field
          label="Course name"
          value={form.name}
          set={(v) => update('name', v)}
        />
        <Field
          label="Year"
          value={form.yearLabel}
          set={(v) => update('yearLabel', v)}
        />
        <Field
          label="Section"
          value={form.sectionLabel}
          set={(v) => update('sectionLabel', v)}
        />
        <Field
          label="Institution"
          value={form.institution}
          set={(v) => update('institution', v)}
        />
        <Field
          label="College"
          value={form.college}
          set={(v) => update('college', v)}
        />
        <Field
          label="Description"
          value={form.description}
          set={(v) => update('description', v)}
          area
        />
      </>
    );
  if (entity === 'subject')
    return (
      <>
        <Field
          label="Subject name"
          value={form.name}
          set={(v) => update('name', v)}
        />
        <Field
          label="Subject code"
          value={form.code}
          set={(v) => update('code', v)}
        />
        <Field
          label="Next topic"
          value={form.topic}
          set={(v) => update('topic', v)}
        />
      </>
    );
  if (entity === 'lecture')
    return (
      <>
        <label>
          Subject
          <select
            value={form.subjectId}
            onChange={(e) => update('subjectId', e.target.value)}
            required
          >
            <option value="">Choose subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Lecture title"
          value={form.title}
          set={(v) => update('title', v)}
        />
        <Field
          label="Summary"
          value={form.summary}
          set={(v) => update('summary', v)}
          area
        />
      </>
    );
  if (entity === 'schedule')
    return (
      <>
        <Field
          label="Event title"
          value={form.title}
          set={(v) => update('title', v)}
        />
        <Field
          label="Location"
          value={form.location}
          set={(v) => update('location', v)}
        />
        <Field
          label="Starts"
          value={form.startsAt}
          set={(v) => update('startsAt', v)}
          type="datetime-local"
        />
        <Field
          label="Ends"
          value={form.endsAt}
          set={(v) => update('endsAt', v)}
          type="datetime-local"
        />
        <label>
          Event type
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
          >
            <option value="class">Class</option>
            <option value="exam">Exam</option>
            <option value="deadline">Deadline</option>
            <option value="study">Study session</option>
          </select>
        </label>
        <Field
          label="Notes"
          value={form.notes}
          set={(v) => update('notes', v)}
          area
        />
      </>
    );
  if (entity === 'room')
    return (
      <>
        <Field
          label="Room name"
          value={form.name}
          set={(v) => update('name', v)}
        />
        <Field
          label="Capacity"
          value={form.capacity}
          set={(v) => update('capacity', v)}
          type="number"
        />
        <label>
          Room type
          <select
            value={form.type}
            onChange={(e) => update('type', e.target.value)}
          >
            <option>Physical room</option>
            <option>Online room</option>
          </select>
        </label>
        <Field
          label="Availability"
          value={form.availability}
          set={(v) => update('availability', v)}
        />
        <Field
          label="Meeting URL (optional)"
          value={form.meetingUrl}
          set={(v) => update('meetingUrl', v)}
          type="url"
          required={false}
        />
      </>
    );
  return (
    <Field
      label="Post text"
      value={form.text}
      set={(v) => update('text', v)}
      area
    />
  );
}

function Field({
  label,
  value,
  set,
  type = 'text',
  area = false,
  required = true,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  area?: boolean;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      {area ? (
        <textarea
          value={value}
          onChange={(e) => set(e.target.value)}
          required={required}
          rows={5}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => set(e.target.value)}
          required={required}
        />
      )}
    </label>
  );
}

function CourseContent({ state }: { state: CampusState }) {
  return (
    <section className="course-content-manager">
      <div className="content-manager-head">
        <div>
          <span className="marketing-kicker">
            {state.subjects.length} SUBJECTS
          </span>
          <h2>Published course content</h2>
        </div>
        <a className="editor-primary-link" href="/app/manage/subject?mode=new">
          <Plus size={16} />
          Add subject
        </a>
      </div>
      <div className="content-manager-grid">
        {state.subjects.map((subject) => (
          <article key={subject.id}>
            <span>{subject.icon}</span>
            <div>
              <strong>{subject.name}</strong>
              <small>
                {subject.code} · {subject.lectures} lectures
              </small>
            </div>
            <div>
              <a
                href={`/app/manage/subject?mode=edit&id=${encodeURIComponent(subject.id)}`}
              >
                Edit
              </a>
              <a
                href={`/app/subjects/${encodeURIComponent(subject.id)}/add-lecture`}
              >
                Add lecture
              </a>
            </div>
          </article>
        ))}
      </div>
      <div className="content-shortcuts">
        <a href="/app/manage/schedule?mode=new">
          <CalendarDays />
          Add schedule event
        </a>
        <a href="/app/manage/room?mode=new">
          <DoorOpen />
          Add study room
        </a>
      </div>
    </section>
  );
}

function EditorMessage({ title, text }: { title: string; text: string }) {
  return (
    <main className="editor-message">
      <div>
        <Check size={28} />
        <h1>{title}</h1>
        <p>{text}</p>
        <a href="/app">Return to workspace</a>
      </div>
    </main>
  );
}
