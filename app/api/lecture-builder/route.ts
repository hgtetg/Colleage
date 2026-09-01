import { unzipSync } from 'fflate';
import { campusCourseId, getDb, getEnv, requireViewer } from '@/lib/campus-db';
import { requireSameOrigin } from '@/lib/auth';
import {
  getLectureImages,
  isRichLesson,
  lectureSummary,
  lectureTitle,
  type LectureBlock,
  type LessonContract,
  type RichLectureSection,
  type RichLectureSubsection,
  type RichLessonContract,
} from '@/lib/lecture-contract';

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

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function contentText(value: unknown, maximum = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function textList(value: unknown, maximumItems: number, maximumLength = 600) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maximumItems).map((item) => safeText(item, maximumLength)).filter(Boolean);
}

function sectionId(value: unknown, fallback: string) {
  return (safeText(value, 48).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || fallback).slice(0, 48);
}

function validateRichBlock(value: unknown, knownLocations: Set<string>, label: string): LectureBlock {
  const block = asRecord(value);
  const type = safeText(block?.type, 24);
  if (!block || !type) throw new Error(`${label} contains an invalid content block.`);
  if (type === 'paragraph') {
    const text = contentText(block.text);
    if (!text) throw new Error(`${label} contains an empty paragraph.`);
    return { type, text };
  }
  if (type === 'list') {
    const items = textList(block.items, 40, 1000);
    if (!items.length) throw new Error(`${label} contains an empty list.`);
    return { type, style: block.style === 'numbered' ? 'numbered' : 'bulleted', items };
  }
  if (type === 'quote') {
    const text = contentText(block.text, 2500);
    if (!text) throw new Error(`${label} contains an empty quote.`);
    const attribution = safeText(block.attribution, 240);
    return { type, text, ...(attribution ? { attribution } : {}) };
  }
  if (type === 'code') {
    const code = contentText(block.code, 12000);
    if (!code) throw new Error(`${label} contains an empty code block.`);
    const language = safeText(block.language, 40);
    return { type, code, ...(language ? { language } : {}) };
  }
  if (type === 'image') {
    const src = normaliseLocation(safeText(block.src, 220));
    const alt = safeText(block.alt, 260);
    const caption = safeText(block.caption, 500);
    if (!src || !alt) throw new Error(`${label} contains an image without a source path or accessible description.`);
    if (!knownLocations.has(src)) throw new Error(`The image location “${src}” was not found in the uploaded lecture source.`);
    return { type, src, alt, ...(caption ? { caption } : {}) };
  }
  if (type === 'table') {
    const headers = textList(block.headers, 20, 300);
    const rows = Array.isArray(block.rows)
      ? block.rows.slice(0, 100).map((row) => textList(row, 20, 1000)).filter((row) => row.length)
      : [];
    if (!rows.length) throw new Error(`${label} contains an empty table.`);
    return { type, ...(headers.length ? { headers } : {}), rows };
  }
  if (type === 'formula') {
    const text = contentText(block.text, 2000);
    if (!text) throw new Error(`${label} contains an empty formula.`);
    const note = contentText(block.note, 1500);
    return { type, text, ...(note ? { note } : {}) };
  }
  if (type === 'example') {
    const text = contentText(block.text, 5000);
    if (!text) throw new Error(`${label} contains an empty example.`);
    const title = safeText(block.title, 160);
    return { type, text, ...(title ? { title } : {}) };
  }
  if (type === 'definition') {
    const term = safeText(block.term, 160);
    const text = contentText(block.text, 3000);
    if (!term || !text) throw new Error(`${label} contains an incomplete definition.`);
    return { type, term, text };
  }
  throw new Error(`${label} uses the unsupported content type “${type}”.`);
}

function validateSubsections(value: unknown, knownLocations: Set<string>, sectionLabel: string, ids: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((raw, index): RichLectureSubsection => {
    const subsection = asRecord(raw);
    const id = sectionId(subsection?.id, `${sectionLabel}-subsection-${index + 1}`);
    const heading = safeText(subsection?.heading, 180);
    if (!subsection || !heading || ids.has(id)) throw new Error(`${sectionLabel} has an invalid or duplicate subsection.`);
    ids.add(id);
    if (!Array.isArray(subsection.content) || !subsection.content.length)
      throw new Error(`Subsection “${heading}” needs at least one content block.`);
    const content = subsection.content.slice(0, 60).map((block) => validateRichBlock(block, knownLocations, `Subsection “${heading}”`));
    const keyPoints = textList(subsection.key_points, 20, 600);
    return { id, heading, content, ...(keyPoints.length ? { key_points: keyPoints } : {}) };
  });
}

function validateRichLesson(root: Record<string, unknown>, manifest: SourceImage[]): RichLessonContract {
  const meta = asRecord(root.meta);
  const title = safeText(meta?.title, 160);
  const duration = Number(meta?.duration_minutes);
  if (!title || !Number.isInteger(duration) || duration < 3 || duration > 360)
    throw new Error('The lecture title or duration is incomplete.');
  if (!Array.isArray(root.sections) || !root.sections.length || root.sections.length > 20)
    throw new Error('The JSON file needs between 1 and 20 structured lecture sections.');
  const knownLocations = new Set(manifest.map((image) => normaliseLocation(image.sourceLocation)));
  const ids = new Set<string>();
  const sections = root.sections.map((raw, index): RichLectureSection => {
    const section = asRecord(raw);
    const id = sectionId(section?.id, `section-${index + 1}`);
    const heading = safeText(section?.heading, 180);
    if (!section || !heading || ids.has(id)) throw new Error(`Section ${index + 1} has an invalid or duplicate id or heading.`);
    ids.add(id);
    if (!Array.isArray(section.content)) throw new Error(`Section “${heading}” needs a content array.`);
    const content = section.content.slice(0, 60).map((block) => validateRichBlock(block, knownLocations, `Section “${heading}”`));
    const intro = contentText(section.intro, 1200);
    const keyPoints = textList(section.key_points, 20, 600);
    const subsections = validateSubsections(section.subsections, knownLocations, id, ids);
    if (!content.length && !subsections.length) throw new Error(`Section “${heading}” has no lecture content.`);
    return {
      id, heading, content,
      ...(intro ? { intro } : {}),
      ...(keyPoints.length ? { key_points: keyPoints } : {}),
      ...(subsections.length ? { subsections } : {}),
    };
  });

  const metaResult: RichLessonContract['meta'] = { title, duration_minutes: duration };
  const subtitle = safeText(meta?.subtitle, 300);
  const course = safeText(meta?.course, 160);
  const instructor = safeText(meta?.instructor, 160);
  const date = safeText(meta?.date, 100);
  if (subtitle) metaResult.subtitle = subtitle;
  if (course) metaResult.course = course;
  if (instructor) metaResult.instructor = instructor;
  if (date) metaResult.date = date;

  const objectives = textList(root.objectives, 12, 800);
  const keyTerms = Array.isArray(root.key_terms)
    ? root.key_terms.slice(0, 100).map((raw) => {
        const term = asRecord(raw);
        return { term: safeText(term?.term, 160), definition: contentText(term?.definition, 1600) };
      }).filter((item) => item.term && item.definition)
    : [];
  const summary = Array.isArray(root.summary)
    ? textList(root.summary, 12, 1800)
    : contentText(root.summary, 6000);
  const furtherReading = Array.isArray(root.further_reading)
    ? root.further_reading.slice(0, 30).map((raw) => {
        const item = asRecord(raw);
        const itemTitle = safeText(item?.title, 240);
        const url = safeText(item?.url, 1000);
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) return null;
          return itemTitle ? { title: itemTitle, url: parsed.toString() } : null;
        } catch { return null; }
      }).filter((item): item is { title: string; url: string } => Boolean(item))
    : [];
  const tocLabel = safeText(root.toc_label, 80) || 'Contents';
  return {
    schemaVersion: 'campus-hub-lecture/v2', meta: metaResult, toc_label: tocLabel, sections,
    ...(objectives.length ? { objectives } : {}),
    ...(keyTerms.length ? { key_terms: keyTerms } : {}),
    ...(Array.isArray(summary) ? (summary.length ? { summary } : {}) : (summary ? { summary } : {})),
    ...(furtherReading.length ? { further_reading: furtherReading } : {}),
  };
}

function validateLegacyLesson(root: Record<string, unknown>, manifest: SourceImage[]): LessonContract {
  const lecture = asRecord(root.lecture);
  const title = safeText(lecture?.title, 120);
  const summary = safeText(lecture?.summary, 300);
  const estimatedMinutes = Number(lecture?.estimatedMinutes);
  if (!title || !summary || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 3 || estimatedMinutes > 120)
    throw new Error('The lecture title, summary, or estimated reading time is incomplete.');
  if (!Array.isArray(root.sections) || root.sections.length < 3 || root.sections.length > 8)
    throw new Error('The legacy JSON file needs between 3 and 8 structured lecture sections.');
  const knownLocations = new Set(manifest.map((image) => normaliseLocation(image.sourceLocation)));
  const ids = new Set<string>();
  const sections = root.sections.map((raw, index) => {
    const section = asRecord(raw);
    const id = sectionId(section?.id, `section-${index + 1}`);
    const sectionTitle = safeText(section?.title, 100);
    const body = safeText(section?.body, 1200);
    const keyPoint = safeText(section?.keyPoint, 220);
    const image = asRecord(section?.image);
    const imageTitle = safeText(image?.title, 120);
    const caption = safeText(image?.caption, 300);
    const location = normaliseLocation(safeText(image?.location, 220));
    const alt = safeText(image?.alt, 220) || imageTitle;
    if (!section || ids.has(id) || !sectionTitle || !body || !keyPoint || !imageTitle || !caption || !location)
      throw new Error(`Section ${index + 1} is missing required lesson or image fields.`);
    if (!knownLocations.has(location)) throw new Error(`The image location “${location}” was not found in the uploaded lecture source.`);
    ids.add(id);
    return { id, title: sectionTitle, body, keyPoint, image: { title: imageTitle, caption, location, alt } };
  });
  return { schemaVersion: 'campus-hub-lecture/v1', lecture: { title, summary, estimatedMinutes }, sections };
}

function validateLessonContract(value: unknown, manifest: SourceImage[]): LessonContract {
  const root = asRecord(value);
  if (!root) throw new Error('The AI-agent output must be one JSON object.');
  if (root.schemaVersion === 'campus-hub-lecture/v2') return validateRichLesson(root, manifest);
  if (root.schemaVersion === 'campus-hub-lecture/v1') return validateLegacyLesson(root, manifest);
  throw new Error('Use the downloaded Campus Hub v2 JSON schema. Its schemaVersion is missing or incorrect.');
}

function validateImageSelections(value: unknown, lesson: LessonContract, manifest: SourceImage[]) {
  const selections = parseSelections(value);
  const locations = new Set(manifest.map((image) => normaliseLocation(image.sourceLocation)));
  const saved: Record<string, string> = {};
  for (const reference of getLectureImages(lesson)) {
    const selected = normaliseLocation(selections[reference.key] || reference.location);
    if (!locations.has(selected)) throw new Error(`Choose a valid source image for “${reference.title}”.`);
    saved[reference.key] = selected;
  }
  return saved;
}

function buildLectureContent(lesson: LessonContract, manifest: SourceImage[], selections: Record<string, string>) {
  const assets = new Map(manifest.map((image) => [normaliseLocation(image.sourceLocation), image]));
  if (isRichLesson(lesson)) {
    const references = getLectureImages(lesson);
    let imageIndex = 0;
    const rewriteBlocks = (blocks: LectureBlock[]) => blocks.map((block): LectureBlock => {
      if (block.type !== 'image') return block;
      const reference = references[imageIndex++];
      const location = normaliseLocation(selections[reference.key] || reference.location);
      const asset = assets.get(location);
      return {
        ...block,
        src: asset ? `/api/files?key=${encodeURIComponent(asset.objectKey)}` : '',
        sourceLocation: location,
      };
    });
    return {
      ...lesson,
      sections: lesson.sections.map((section) => ({
        ...section,
        content: rewriteBlocks(section.content),
        subsections: section.subsections?.map((subsection) => ({
          ...subsection,
          content: rewriteBlocks(subsection.content),
        })),
      })),
    };
  }
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
      const manifestForValidation = extracted.map((image) => ({ ...image, objectKey: '' }));
      let output: unknown;
      try { output = JSON.parse(await agentFile.text()); } catch { return json({ error: 'The AI-agent output is not valid JSON.' }, 400); }
      let lesson: LessonContract;
      try { lesson = validateLessonContract(output, manifestForValidation); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'The JSON file does not match the lecture contract.' }, 400); }
      if (getLectureImages(lesson).length && !extracted.length)
        return json({ error: 'The JSON references source images, but no usable images were found in the uploaded lecture file.' }, 400);
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
        const selections = Object.fromEntries(getLectureImages(lesson).map((image) => [image.key, image.location]));
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
      if (!lesson || (getLectureImages(lesson).length > 0 && !manifest.length)) return json({ error: 'Upload a validated JSON output and its referenced source images first.' }, 400);
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
      if (!lesson || (getLectureImages(lesson).length > 0 && !manifest.length)) return json({ error: 'The saved lecture contract is incomplete.' }, 400);
      let selections: Record<string, string>;
      try { selections = validateImageSelections(draft.image_selections, lesson, manifest); }
      catch (error) { return json({ error: error instanceof Error ? error.message : 'The selected images are invalid.' }, 400); }
      const subject = await getCourseSubject(db, draft.subject_id);
      if (!subject) return json({ error: 'Subject not found.' }, 404);
      const content = buildLectureContent(lesson, manifest, selections);
      const position = await db.prepare(`SELECT COALESCE(MAX(position),0)+1 AS next_position FROM lectures WHERE subject_id=?`).bind(subject.id).first<{ next_position: number }>();
      const lectureId = crypto.randomUUID();
      const uniqueAssets = [...new Map(getLectureImages(lesson).map((image) => {
        const sourceLocation = normaliseLocation(selections[image.key] || image.location);
        return [sourceLocation, { ...image, sourceLocation }];
      })).values()];
      await db.batch([
        db.prepare(`INSERT INTO lectures (id,subject_id,title,summary,position,published,design,content_json) VALUES (?,?,?,?,?,?,?,?)`).bind(lectureId, subject.id, lectureTitle(lesson), lectureSummary(lesson), position?.next_position ?? 1, 1, draft.design, JSON.stringify(content)),
        ...uniqueAssets.map((image) => {
          const asset = manifest.find((item) => item.sourceLocation === image.sourceLocation);
          return db.prepare(`INSERT INTO lecture_assets (id,lecture_id,object_key,source_location,title,caption) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), lectureId, asset!.objectKey, image.sourceLocation, image.title, image.caption);
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
