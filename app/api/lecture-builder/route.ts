import { campusCourseId, getDb, getEnv, requireViewer } from '@/lib/campus-db';
import { requireSameOrigin } from '@/lib/auth';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

const allowedAgents = new Set(['chatgpt', 'claude', 'gemini']);
const allowedDesigns = new Set(['atelier', 'midnight', 'citrus']);

type DraftRow = {
  id: string;
  subject_id: string;
  agent: string;
  lecture_file_key: string | null;
  lecture_file_name: string | null;
  agent_file_key: string | null;
  agent_file_name: string | null;
  design: string;
  image_choices: string;
  status: string;
};

type SubjectRow = { id: string; name: string; code: string; next_topic: string };

type LectureSection = {
  title: string;
  body: string;
  image: number;
  keyPoint?: string;
};

function isManager(role: string) {
  return role === 'representative' || role === 'admin';
}

function safeText(value: unknown, maximum = 800) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maximum)
    : '';
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) || 'file';
}

function imageChoices(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : [];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 8)
    .map(Number)
    .slice(0, 6);
}

function draftPayload(draft: DraftRow) {
  return {
    id: draft.id,
    subjectId: draft.subject_id,
    agent: draft.agent,
    lectureFileName: draft.lecture_file_name,
    agentFileName: draft.agent_file_name,
    design: draft.design,
    imageChoices: imageChoices(draft.image_choices),
    status: draft.status,
  };
}

async function getCourseSubject(db: D1Database, subjectId: string) {
  return db
    .prepare(`SELECT id,name,code,next_topic FROM subjects WHERE id=? AND course_id=?`)
    .bind(subjectId, campusCourseId)
    .first<SubjectRow>();
}

async function getOwnedDraft(db: D1Database, draftId: string, viewerId: string) {
  return db
    .prepare(
      `SELECT id,subject_id,agent,lecture_file_key,lecture_file_name,agent_file_key,agent_file_name,design,image_choices,status FROM lecture_drafts WHERE id=? AND created_by=? AND status='draft'`,
    )
    .bind(draftId, viewerId)
    .first<DraftRow>();
}

function fallbackSections(subject: SubjectRow): Omit<LectureSection, 'image'>[] {
  const focus = subject.next_topic || `core ${subject.name} concepts`;
  return [
    {
      title: 'Set the foundation',
      body: `Start with the essential terms and the problem this topic helps solve. Connect each definition to ${focus}.`,
      keyPoint: 'A strong definition makes the rest of the lecture easier to reason about.',
    },
    {
      title: 'Work through the model',
      body: `Break the concept into small operations. Trace one example from input to result and name the decision made at each step.`,
      keyPoint: 'Follow the flow before trying to memorize the final answer.',
    },
    {
      title: 'Compare the trade-offs',
      body: `Contrast the common approaches, noting when each one is fast, simple, flexible, or costly.`,
      keyPoint: 'Good engineering choices depend on the constraints of the problem.',
    },
    {
      title: 'Apply and reflect',
      body: `Use the idea in a short practice task, then explain why your chosen approach fits the example.`,
      keyPoint: 'Explaining the choice is as important as reaching the answer.',
    },
  ];
}

function outputSections(value: unknown, subject: SubjectRow) {
  const fallback = fallbackSections(subject);
  const source =
    value && typeof value === 'object' && Array.isArray((value as { sections?: unknown[] }).sections)
      ? (value as { sections: unknown[] }).sections
      : [];
  const cleaned = source
    .slice(0, 6)
    .map((item) => {
      const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const title = safeText(record.title, 90);
      const body = safeText(record.body ?? record.content ?? record.text, 850);
      const keyPoint = safeText(record.keyPoint ?? record.key_point, 180);
      return title && body ? { title, body, keyPoint: keyPoint || undefined } : null;
    })
    .filter((item): item is Omit<LectureSection, 'image'> => Boolean(item));
  return cleaned.length >= 2 ? cleaned : fallback;
}

async function buildLectureContent(
  subject: SubjectRow,
  outputKey: string,
  selections: number[],
) {
  let raw = '';
  try {
    const object = await getEnv().FILES.get(outputKey);
    if (object && object.size <= 1_000_000) raw = await object.text();
  } catch {
    // The uploaded output remains available even if it cannot be parsed as text.
  }
  let parsed: unknown = null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parsed = null;
    }
  }
  const markdownTitle = trimmed.match(/^#{1,2}\s+(.+)$/m)?.[1] ?? '';
  const record = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const title =
    safeText(record.title, 120) ||
    safeText(markdownTitle, 120) ||
    `${subject.name}: ${subject.next_topic || 'Interactive study guide'}`;
  const summary =
    safeText(record.summary ?? record.subtitle ?? record.description, 260) ||
    `An interactive ${subject.code} lecture built from your AI-agent research output.`;
  const images = selections.length ? selections : [0, 1, 2, 3];
  const sections = outputSections(parsed, subject).map((section, index) => ({
    ...section,
    image: images[index % images.length],
  }));
  return { title, subtitle: summary, sections };
}

export async function GET(request: Request) {
  const db = getDb();
  try {
    const viewer = await requireViewer(request, db);
    if (!isManager(viewer.role))
      return json({ error: 'Representative permission is required.' }, 403);
    const subjectId = new URL(request.url).searchParams.get('subjectId') ?? '';
    if (!(await getCourseSubject(db, subjectId)))
      return json({ error: 'Subject not found.' }, 404);
    const draft = await db
      .prepare(
        `SELECT id,subject_id,agent,lecture_file_key,lecture_file_name,agent_file_key,agent_file_name,design,image_choices,status FROM lecture_drafts WHERE subject_id=? AND created_by=? AND status='draft' ORDER BY updated_at DESC LIMIT 1`,
      )
      .bind(subjectId, viewer.id)
      .first<DraftRow>();
    return json({ draft: draft ? draftPayload(draft) : null });
  } catch (error) {
    return error instanceof Response
      ? error
      : json({ error: 'Unable to open this lecture draft.' }, 500);
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    requireSameOrigin(request);
    const viewer = await requireViewer(request, db);
    if (!isManager(viewer.role))
      return json({ error: 'Representative permission is required.' }, 403);

    const isMultipart = (request.headers.get('content-type') ?? '').includes('multipart/form-data');
    const form = isMultipart ? await request.formData() : null;
    const body = form ? null : ((await request.json()) as Record<string, unknown>);
    const action = safeText(form?.get('action') ?? body?.action, 40);

    if (action === 'start') {
      const subjectId = safeText(body?.subjectId, 120);
      const agent = safeText(body?.agent, 30);
      if (!allowedAgents.has(agent)) return json({ error: 'Choose a valid AI agent.' }, 400);
      if (!(await getCourseSubject(db, subjectId)))
        return json({ error: 'Subject not found.' }, 404);
      let draft = await db
        .prepare(
          `SELECT id,subject_id,agent,lecture_file_key,lecture_file_name,agent_file_key,agent_file_name,design,image_choices,status FROM lecture_drafts WHERE subject_id=? AND created_by=? AND status='draft' ORDER BY updated_at DESC LIMIT 1`,
        )
        .bind(subjectId, viewer.id)
        .first<DraftRow>();
      if (draft) {
        await db
          .prepare(`UPDATE lecture_drafts SET agent=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .bind(agent, draft.id)
          .run();
        draft.agent = agent;
      } else {
        const id = crypto.randomUUID();
        await db
          .prepare(`INSERT INTO lecture_drafts (id,subject_id,created_by,agent) VALUES (?,?,?,?)`)
          .bind(id, subjectId, viewer.id, agent)
          .run();
        draft = {
          id,
          subject_id: subjectId,
          agent,
          lecture_file_key: null,
          lecture_file_name: null,
          agent_file_key: null,
          agent_file_name: null,
          design: 'atelier',
          image_choices: '[]',
          status: 'draft',
        };
      }
      return json({ draft: draftPayload(draft) });
    }

    if (action === 'upload') {
      const draftId = safeText(form?.get('draftId'), 100);
      const lectureFile = form?.get('lectureFile');
      const agentFile = form?.get('agentFile');
      if (!(lectureFile instanceof File) || !(agentFile instanceof File))
        return json({ error: 'Upload both requested files to continue.' }, 400);
      if (lectureFile.size > 20 * 1024 * 1024 || agentFile.size > 20 * 1024 * 1024)
        return json({ error: 'Each file must be 20 MB or smaller.' }, 400);
      const draft = await getOwnedDraft(db, draftId, viewer.id);
      if (!draft) return json({ error: 'Lecture draft not found.' }, 404);
      const prefix = `lecture-drafts/${viewer.id}/${draft.id}`;
      const lectureKey = `${prefix}/source-${crypto.randomUUID()}-${safeFileName(lectureFile.name)}`;
      const agentKey = `${prefix}/agent-output-${crypto.randomUUID()}-${safeFileName(agentFile.name)}`;
      await getEnv().FILES.put(lectureKey, lectureFile.stream(), {
        httpMetadata: { contentType: lectureFile.type || 'application/octet-stream' },
        customMetadata: { owner: viewer.id, draftId: draft.id, purpose: 'lecture-source' },
      });
      try {
        await getEnv().FILES.put(agentKey, agentFile.stream(), {
          httpMetadata: { contentType: agentFile.type || 'application/octet-stream' },
          customMetadata: { owner: viewer.id, draftId: draft.id, purpose: 'agent-output' },
        });
        await db
          .prepare(
            `UPDATE lecture_drafts SET lecture_file_key=?,lecture_file_name=?,agent_file_key=?,agent_file_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          )
          .bind(lectureKey, lectureFile.name.slice(0, 180), agentKey, agentFile.name.slice(0, 180), draft.id)
          .run();
      } catch (error) {
        await getEnv().FILES.delete(lectureKey);
        throw error;
      }
      if (draft.lecture_file_key) await getEnv().FILES.delete(draft.lecture_file_key);
      if (draft.agent_file_key) await getEnv().FILES.delete(draft.agent_file_key);
      draft.lecture_file_key = lectureKey;
      draft.lecture_file_name = lectureFile.name;
      draft.agent_file_key = agentKey;
      draft.agent_file_name = agentFile.name;
      return json({ draft: draftPayload(draft) });
    }

    const draftId = safeText(body?.draftId, 100);
    const draft = await getOwnedDraft(db, draftId, viewer.id);
    if (!draft) return json({ error: 'Lecture draft not found.' }, 404);
    if (action === 'update_design') {
      const design = safeText(body?.design, 30);
      if (!allowedDesigns.has(design)) return json({ error: 'Choose a valid design.' }, 400);
      await db
        .prepare(`UPDATE lecture_drafts SET design=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(design, draft.id)
        .run();
      draft.design = design;
      return json({ draft: draftPayload(draft) });
    }
    if (action === 'update_images') {
      const choices = imageChoices(body?.imageChoices);
      if (choices.length < 3)
        return json({ error: 'Choose an image for at least three sections.' }, 400);
      await db
        .prepare(`UPDATE lecture_drafts SET image_choices=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(JSON.stringify(choices), draft.id)
        .run();
      draft.image_choices = JSON.stringify(choices);
      return json({ draft: draftPayload(draft) });
    }
    if (action === 'publish') {
      if (!draft.lecture_file_key || !draft.agent_file_key)
        return json({ error: 'Upload the lecture source and agent output first.' }, 400);
      const subject = await getCourseSubject(db, draft.subject_id);
      if (!subject) return json({ error: 'Subject not found.' }, 404);
      const content = await buildLectureContent(
        subject,
        draft.agent_file_key,
        imageChoices(draft.image_choices),
      );
      const position = await db
        .prepare(`SELECT COALESCE(MAX(position),0)+1 AS next_position FROM lectures WHERE subject_id=?`)
        .bind(subject.id)
        .first<{ next_position: number }>();
      const lectureId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO lectures (id,subject_id,title,summary,position,published,design,content_json) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          lectureId,
          subject.id,
          content.title,
          content.subtitle,
          position?.next_position ?? 1,
          1,
          draft.design,
          JSON.stringify(content),
        )
        .run();
      await db
        .prepare(`UPDATE lecture_drafts SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .bind(draft.id)
        .run();
      return json({ ok: true, lectureId });
    }
    return json({ error: 'Unsupported lecture-builder action.' }, 400);
  } catch (error) {
    return error instanceof Response
      ? error
      : json({ error: 'The lecture workflow could not be completed.' }, 500);
  }
}
