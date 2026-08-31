import { unzipSync } from 'fflate';
import { campusCourseId, getDb, getEnv, requireViewer } from '@/lib/campus-db';
import { requireSameOrigin } from '@/lib/auth';

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

const allowedAgents = new Set(['chatgpt', 'claude', 'gemini']);
const allowedDesigns = new Set(['atelier', 'midnight', 'citrus']);
const supportedImageExtensions = new Map([
  ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'], ['gif', 'image/gif'],
]);
const maximumImageBytes = 6 * 1024 * 1024;
const maximumExtractedBytes = 30 * 1024 * 1024;
const maximumExtractedImages = 24;

type DraftRow = {
  id: string; subject_id: string; agent: string; lecture_file_key: string | null;
  lecture_file_name: string | null; agent_file_key: string | null; agent_file_name: string | null;
  design: string; image_manifest: string; lesson_json: string; image_selections: string; status: string;
};
type SubjectRow = { id: string; name: string; code: string; next_topic: string };
type SourceImage = { sourceLocation: string; objectKey: string; fileName: string; contentType: string };
type ExtractedImage = Omit<SourceImage, 'objectKey'> & { data: Uint8Array };
type AgentImage = { title: string; caption: string; location: string; alt: string };
type AgentSection = { id: string; title: string; body: string; keyPoint?: string; image: AgentImage };
type LessonContract = {
  schemaVersion: 'campus-hub-lecture/v1';
  lecture: { title: string; summary: string; estimatedMinutes: number };
  sections: AgentSection[];
};

function isManager(role: string) { return role === 'representative' || role === 'admin'; }
function safeText(value: unknown, maximum = 800) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
}
function safeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100) || 'file'; }
function extension(value: string) { return value.toLowerCase().split('.').pop() ?? ''; }
function normaliseLocation(value: string) { return value.replaceAll('\\', '/').replace(/^\/+/, '').trim(); }
function fileNameFromLocation(value: string) { return normaliseLocation(value).split('/').pop() || 'source-image'; }
function imageMimeType(path: string) { return supportedImageExtensions.get(extension(path)) ?? null; }

function parseArray<T>(value: unknown): T[] {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch { return []; }
}
function parseSelections(value: unknown) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([key, item]) => /^[a-z0-9-]{2,48}$/i.test(key) && typeof item === 'string')
        .map(([key, item]) => [key, normaliseLocation(item as string)]),
    );
  } catch { return {}; }
}
function parseLesson(value: unknown): LessonContract | null {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? (parsed as LessonContract) : null;
  } catch { return null; }
}

function draftPayload(draft: DraftRow) {
  const manifest = parseArray<SourceImage>(draft.image_manifest);
  return {
    id: draft.id,
    subjectId: draft.subject_id,
    agent: draft.agent,
    lectureFileName: draft.lecture_file_name,
    agentFileName: draft.agent_file_name,
    design: draft.design,
    imageManifest: manifest.map((image) => ({
      sourceLocation: image.sourceLocation, fileName: image.fileName, contentType: image.contentType,
      url: `/api/files?key=${encodeURIComponent(image.objectKey)}`,
    })),
    lesson: parseLesson(draft.lesson_json),
    imageSelections: parseSelections(draft.image_selections),
    status: draft.status,
  };
}

async function getCourseSubject(db: D1Database, subjectId: string) {
  return db.prepare(`SELECT id,name,code,next_topic FROM subjects WHERE id=? AND course_id=?`)
    .bind(subjectId, campusCourseId).first<SubjectRow>();
}
const draftFields = `id,subject_id,agent,lecture_file_key,lecture_file_name,agent_file_key,agent_file_name,design,image_manifest,lesson_json,image_selections,status`;
async function getOwnedDraft(db: D1Database, draftId: string, viewerId: string) {
  return db.prepare(`SELECT ${draftFields} FROM lecture_drafts WHERE id=? AND created_by=? AND status='draft'`)
    .bind(draftId, viewerId).first<DraftRow>();
}

function isOfficeImageLocation(path: string, sourceExtension: string) {
  const normalized = normaliseLocation(path).toLowerCase();
  if (!imageMimeType(normalized)) return false;
  if (sourceExtension === 'pptx') return normalized.startsWith('ppt/media/');
  if (sourceExtension === 'docx') return normalized.startsWith('word/media/');
  return normalized.includes('/media/') || normalized.startsWith('media/');
}

async function extractLectureImages(file: File): Promise<ExtractedImage[]> {
  const sourceExtension = extension(file.name);
  const directMime = imageMimeType(file.name);
  if (directMime) {
    if (file.size > maximumImageBytes)
      throw new Error('A direct image source must be 6 MB or smaller.');
    return [{
    sourceLocation: normaliseLocation(file.name), fileName: safeFileName(file.name), contentType: directMime,
    data: new Uint8Array(await file.arrayBuffer()),
    }];
  }
  if (!['pptx', 'docx', 'zip'].includes(sourceExtension)) return [];
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
      filter: (entry) => isOfficeImageLocation(entry.name, sourceExtension) && entry.originalSize > 0 && entry.originalSize <= maximumImageBytes,
    });
  } catch { throw new Error('The lecture source could not be read as an Office file.'); }
  const images = Object.entries(archive)
    .filter(([location, data]) => Boolean(imageMimeType(location)) && data.byteLength <= maximumImageBytes)
    .slice(0, maximumExtractedImages)
    .map(([location, data]) => ({
      sourceLocation: normaliseLocation(location), fileName: fileNameFromLocation(location),
      contentType: imageMimeType(location)!, data,
    }));
  if (images.reduce((sum, image) => sum + image.data.byteLength, 0) > maximumExtractedBytes)
    throw new Error('The extracted source images are too large. Use a smaller lecture file.');
  return images;
}

function validateLessonContract(value: unknown, manifest: SourceImage[]) {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  if (!root) throw new Error('The AI-agent output must be a JSON object.');
  if (root.schemaVersion !== 'campus-hub-lecture/v1') throw new Error('Use the Campus Hub JSON contract file. The schema version is missing or incorrect.');
  const lecture = root.lecture && typeof root.lecture === 'object' && !Array.isArray(root.lecture) ? root.lecture as Record<string, unknown> : null;
  const title = safeText(lecture?.title, 120);
  const summary = safeText(lecture?.summary, 300);
  const estimatedMinutes = Number(lecture?.estimatedMinutes);
  if (!title || !summary || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 3 || estimatedMinutes > 120)
    throw new Error('The lecture title, summary, or estimated reading time is incomplete.');
  if (!Array.isArray(root.sections) || root.sections.length < 3 || root.sections.length > 8)
    throw new Error('The JSON file needs between 3 and 8 structured lecture sections.');
  const knownLocations = new Set(manifest.map((image) => normaliseLocation(image.sourceLocation)));
  const ids = new Set<string>();
  const sections = root.sections.map((raw, index) => {
    const section = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    const id = safeText(section?.id, 48).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    const sectionTitle = safeText(section?.title, 100);
    const body = safeText(section?.body, 1200);
    const keyPoint = safeText(section?.keyPoint, 220);
    const image = section?.image && typeof section.image === 'object' && !Array.isArray(section.image) ? section.image as Record<string, unknown> : null;
    const imageTitle = safeText(image?.title, 120);
    const caption = safeText(image?.caption, 300);
    const location = normaliseLocation(safeText(image?.location, 220));
    const alt = safeText(image?.alt, 220) || imageTitle;
    if (!id || ids.has(id) || !sectionTitle || !body || !keyPoint || !imageTitle || !caption || !location)
      throw new Error(`Section ${index + 1} is missing required lesson or image fields.`);
    if (!knownLocations.has(location)) throw new Error(`The image location “${location}” was not found in the uploaded lecture source.`);
    ids.add(id);
    return { id, title: sectionTitle, body, keyPoint, image: { title: imageTitle, caption, location, alt } };
  });
  return { schemaVersion: 'campus-hub-lecture/v1' as const, lecture: { title, summary, estimatedMinutes }, sections };
}

function validateImageSelections(value: unknown, lesson: LessonContract, manifest: SourceImage[]) {
  const selections = parseSelections(value);
  const locations = new Set(manifest.map((image) => normaliseLocation(image.sourceLocation)));
  const saved: Record<string, string> = {};
  for (const section of lesson.sections) {
    const selected = normaliseLocation(selections[section.id] || section.image.location);
    if (!locations.has(selected)) throw new Error(`Choose a valid source image for “${section.image.title}”.`);
    saved[section.id] = selected;
  }
  return saved;
}

function buildLectureContent(lesson: LessonContract, manifest: SourceImage[], selections: Record<string, string>) {
  const assets = new Map(manifest.map((image) => [normaliseLocation(image.sourceLocation), image]));
  return {
    title: lesson.lecture.title, subtitle: lesson.lecture.summary, estimatedMinutes: lesson.lecture.estimatedMinutes,
    sections: lesson.sections.map((section) => {
      const location = selections[section.id] || section.image.location;
      const asset = assets.get(location);
      return {
        id: section.id, title: section.title, body: section.body, keyPoint: section.keyPoint,
        image: {
          title: section.image.title, caption: section.image.caption, sourceLocation: location,
          alt: section.image.alt, url: asset ? `/api/files?key=${encodeURIComponent(asset.objectKey)}` : null,
        },
      };
    }),
  };
}

export async function GET(request: Request) {
  const db = getDb();
  try {
    const viewer = await requireViewer(request, db);
    if (!isManager(viewer.role)) return json({ error: 'Representative permission is required.' }, 403);
    const subjectId = new URL(request.url).searchParams.get('subjectId') ?? '';
    if (!(await getCourseSubject(db, subjectId))) return json({ error: 'Subject not found.' }, 404);
    const draft = await db.prepare(`SELECT ${draftFields} FROM lecture_drafts WHERE subject_id=? AND created_by=? AND status='draft' ORDER BY updated_at DESC LIMIT 1`)
      .bind(subjectId, viewer.id).first<DraftRow>();
    return json({ draft: draft ? draftPayload(draft) : null });
  } catch (error) {
    return error instanceof Response ? error : json({ error: 'Unable to open this lecture draft.' }, 500);
  }
}

export async function POST(request: Request) {
  const db = getDb();
  try {
    requireSameOrigin(request);
    const viewer = await requireViewer(request, db);
    if (!isManager(viewer.role)) return json({ error: 'Representative permission is required.' }, 403);
    const isMultipart = (request.headers.get('content-type') ?? '').includes('multipart/form-data');
    const form = isMultipart ? await request.formData() : null;
    const body = form ? null : await request.json() as Record<string, unknown>;
    const action = safeText(form?.get('action') ?? body?.action, 40);

    if (action === 'start') {
      const subjectId = safeText(body?.subjectId, 120);
      const agent = safeText(body?.agent, 30);
      if (!allowedAgents.has(agent)) return json({ error: 'Choose a valid AI agent.' }, 400);
      if (!(await getCourseSubject(db, subjectId))) return json({ error: 'Subject not found.' }, 404);
      let draft = await db.prepare(`SELECT ${draftFields} FROM lecture_drafts WHERE subject_id=? AND created_by=? AND status='draft' ORDER BY updated_at DESC LIMIT 1`)
        .bind(subjectId, viewer.id).first<DraftRow>();
      if (draft) {
        await db.prepare(`UPDATE lecture_drafts SET agent=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(agent, draft.id).run();
        draft.agent = agent;
      } else {
        const id = crypto.randomUUID();
        await db.prepare(`INSERT INTO lecture_drafts (id,subject_id,created_by,agent) VALUES (?,?,?,?)`).bind(id, subjectId, viewer.id, agent).run();
        draft = { id, subject_id: subjectId, agent, lecture_file_key: null, lecture_file_name: null, agent_file_key: null, agent_file_name: null, design: 'atelier', image_manifest: '[]', lesson_json: '', image_selections: '{}', status: 'draft' };
      }
      return json({ draft: draftPayload(draft) });
    }

    if (action === 'upload') {
      const draftId = safeText(form?.get('draftId'), 100);
      const lectureFile = form?.get('lectureFile');
      const agentFile = form?.get('agentFile');
      if (!(lectureFile instanceof File) || !(agentFile instanceof File)) return json({ error: 'Upload both requested files to continue.' }, 400);
      if (lectureFile.size > 20 * 1024 * 1024 || agentFile.size > 2 * 1024 * 1024)
        return json({ error: 'The lecture source must be 20 MB or smaller; the JSON output must be 2 MB or smaller.' }, 400);
      if (!agentFile.name.toLowerCase().endsWith('.json')) return json({ error: 'The AI-agent output must be the completed Campus Hub JSON file.' }, 400);
      const draft = await getOwnedDraft(db, draftId, viewer.id);
      if (!draft) return json({ error: 'Lecture draft not found.' }, 404);
      const extracted = await extractLectureImages(lectureFile);
      if (!extracted.length) return json({ error: 'No usable embedded images were found. Upload a PPTX, DOCX, ZIP, or a direct image file.' }, 400);
      const manifestForValidation = extracted.map((image) => ({ ...image, objectKey: '' }));
      let output: unknown;
      try { output = JSON.parse(await agentFile.text()); } catch { return json({ error: 'The AI-agent output is not valid JSON.' }, 400); }
      let lesson: LessonContract;
      try { lesson = validateLessonContract(output, manifestForValidation); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'The JSON file does not match the lecture contract.' }, 400); }
      const prefix = `lecture-drafts/${viewer.id}/${draft.id}`;
      const lectureKey = `${prefix}/source-${crypto.randomUUID()}-${safeFileName(lectureFile.name)}`;
      const agentKey = `${prefix}/agent-output-${crypto.randomUUID()}-${safeFileName(agentFile.name)}`;
      const manifest: SourceImage[] = [];
      const createdKeys = [lectureKey, agentKey];
      try {
        await getEnv().FILES.put(lectureKey, lectureFile.stream(), { httpMetadata: { contentType: lectureFile.type || 'application/octet-stream' }, customMetadata: { owner: viewer.id, draftId: draft.id, purpose: 'lecture-source' } });
        await getEnv().FILES.put(agentKey, agentFile.stream(), { httpMetadata: { contentType: 'application/json' }, customMetadata: { owner: viewer.id, draftId: draft.id, purpose: 'agent-output' } });
        for (const image of extracted) {
          const objectKey = `${prefix}/extracted/${crypto.randomUUID()}-${safeFileName(image.fileName)}`;
          createdKeys.push(objectKey);
          await getEnv().FILES.put(objectKey, image.data, { httpMetadata: { contentType: image.contentType }, customMetadata: { owner: viewer.id, draftId: draft.id, sourceLocation: image.sourceLocation } });
          manifest.push({ ...image, objectKey });
        }
        const selections = Object.fromEntries(lesson.sections.map((section) => [section.id, section.image.location]));
        await db.prepare(`UPDATE lecture_drafts SET lecture_file_key=?,lecture_file_name=?,agent_file_key=?,agent_file_name=?,image_manifest=?,lesson_json=?,image_selections=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .bind(lectureKey, lectureFile.name.slice(0, 180), agentKey, agentFile.name.slice(0, 180), JSON.stringify(manifest), JSON.stringify(lesson), JSON.stringify(selections), draft.id).run();
        const oldManifest = parseArray<SourceImage>(draft.image_manifest);
        await Promise.all([
          ...(draft.lecture_file_key ? [getEnv().FILES.delete(draft.lecture_file_key)] : []),
          ...(draft.agent_file_key ? [getEnv().FILES.delete(draft.agent_file_key)] : []),
          ...oldManifest.map((image) => getEnv().FILES.delete(image.objectKey)),
        ]);
        draft.lecture_file_key = lectureKey; draft.lecture_file_name = lectureFile.name;
        draft.agent_file_key = agentKey; draft.agent_file_name = agentFile.name;
        draft.image_manifest = JSON.stringify(manifest); draft.lesson_json = JSON.stringify(lesson); draft.image_selections = JSON.stringify(selections);
      } catch (error) {
        await Promise.all(createdKeys.map((key) => getEnv().FILES.delete(key)));
        throw error;
      }
      return json({ draft: draftPayload(draft) });
    }

    const draftId = safeText(body?.draftId, 100);
    const draft = await getOwnedDraft(db, draftId, viewer.id);
    if (!draft) return json({ error: 'Lecture draft not found.' }, 404);
    if (action === 'update_design') {
      const design = safeText(body?.design, 30);
      if (!allowedDesigns.has(design)) return json({ error: 'Choose a valid design.' }, 400);
      await db.prepare(`UPDATE lecture_drafts SET design=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(design, draft.id).run();
      draft.design = design;
      return json({ draft: draftPayload(draft) });
    }
    if (action === 'update_images') {
      const lesson = parseLesson(draft.lesson_json);
      const manifest = parseArray<SourceImage>(draft.image_manifest);
      if (!lesson || !manifest.length) return json({ error: 'Upload a validated JSON output and source images first.' }, 400);
      let selections: Record<string, string>;
      try { selections = validateImageSelections(body?.imageSelections, lesson, manifest); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'Choose valid source images.' }, 400); }
      await db.prepare(`UPDATE lecture_drafts SET image_selections=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(JSON.stringify(selections), draft.id).run();
      draft.image_selections = JSON.stringify(selections);
      return json({ draft: draftPayload(draft) });
    }
    if (action === 'publish') {
      if (!draft.lecture_file_key || !draft.agent_file_key) return json({ error: 'Upload the lecture source and validated agent JSON first.' }, 400);
      const lesson = parseLesson(draft.lesson_json);
      const manifest = parseArray<SourceImage>(draft.image_manifest);
      if (!lesson || !manifest.length) return json({ error: 'The saved lecture contract is incomplete.' }, 400);
      let selections: Record<string, string>;
      try { selections = validateImageSelections(draft.image_selections, lesson, manifest); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'The selected images are invalid.' }, 400); }
      const subject = await getCourseSubject(db, draft.subject_id);
      if (!subject) return json({ error: 'Subject not found.' }, 404);
      const content = buildLectureContent(lesson, manifest, selections);
      const position = await db.prepare(`SELECT COALESCE(MAX(position),0)+1 AS next_position FROM lectures WHERE subject_id=?`).bind(subject.id).first<{ next_position: number }>();
      const lectureId = crypto.randomUUID();
      const uniqueAssets = [...new Map(content.sections.map((section) => [section.image.sourceLocation, section])).values()];
      await db.batch([
        db.prepare(`INSERT INTO lectures (id,subject_id,title,summary,position,published,design,content_json) VALUES (?,?,?,?,?,?,?,?)`).bind(lectureId, subject.id, content.title, content.subtitle, position?.next_position ?? 1, 1, draft.design, JSON.stringify(content)),
        ...uniqueAssets.map((section) => {
          const asset = manifest.find((image) => image.sourceLocation === section.image.sourceLocation);
          return db.prepare(`INSERT INTO lecture_assets (id,lecture_id,object_key,source_location,title,caption) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), lectureId, asset!.objectKey, section.image.sourceLocation, section.image.title, section.image.caption);
        }),
        db.prepare(`UPDATE lecture_drafts SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(draft.id),
      ]);
      return json({ ok: true, lectureId });
    }
    return json({ error: 'Unsupported lecture-builder action.' }, 400);
  } catch (error) {
    return error instanceof Response ? error : json({ error: error instanceof Error ? error.message : 'The lecture workflow could not be completed.' }, 500);
  }
}
