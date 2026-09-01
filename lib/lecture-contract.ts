export type LegacyAgentImage = {
  title: string;
  caption: string;
  location: string;
  alt: string;
};

export type LegacyLessonSection = {
  id: string;
  title: string;
  body: string;
  keyPoint?: string;
  image: LegacyAgentImage;
};

export type LegacyLessonContract = {
  schemaVersion: 'campus-hub-lecture/v1';
  lecture: { title: string; summary: string; estimatedMinutes: number };
  sections: LegacyLessonSection[];
};

export type ParagraphBlock = { type: 'paragraph'; text: string };
export type ListBlock = { type: 'list'; style: 'bulleted' | 'numbered'; items: string[] };
export type QuoteBlock = { type: 'quote'; text: string; attribution?: string };
export type CodeBlock = { type: 'code'; language?: string; code: string };
export type ImageBlock = {
  type: 'image';
  src: string;
  alt: string;
  caption?: string;
  sourceLocation?: string;
};
export type TableBlock = { type: 'table'; headers?: string[]; rows: string[][] };
export type FormulaBlock = { type: 'formula'; text: string; note?: string };
export type ExampleBlock = { type: 'example'; title?: string; text: string };
export type DefinitionBlock = { type: 'definition'; term: string; text: string };

export type LectureBlock =
  | ParagraphBlock
  | ListBlock
  | QuoteBlock
  | CodeBlock
  | ImageBlock
  | TableBlock
  | FormulaBlock
  | ExampleBlock
  | DefinitionBlock;

export type RichLectureSubsection = {
  id: string;
  heading: string;
  content: LectureBlock[];
  key_points?: string[];
};

export type RichLectureSection = {
  id: string;
  heading: string;
  intro?: string;
  content: LectureBlock[];
  key_points?: string[];
  subsections?: RichLectureSubsection[];
};

export type RichLessonContract = {
  schemaVersion: 'campus-hub-lecture/v2';
  meta: {
    title: string;
    subtitle?: string;
    course?: string;
    instructor?: string;
    date?: string;
    duration_minutes: number;
  };
  objectives?: string[];
  toc_label?: string;
  sections: RichLectureSection[];
  key_terms?: Array<{ term: string; definition: string }>;
  summary?: string | string[];
  further_reading?: Array<{ title: string; url: string }>;
};

export type LessonContract = LegacyLessonContract | RichLessonContract;

export type LegacyPublishedContent = {
  title?: string;
  subtitle?: string;
  estimatedMinutes?: number;
  sections?: Array<{
    id?: string;
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
  }>;
};

export type PublishedLectureContent = LegacyPublishedContent | RichLessonContract;

export type LectureImageReference = {
  key: string;
  title: string;
  caption: string;
  location: string;
  alt: string;
};

export function isRichLesson(value: LessonContract | PublishedLectureContent | null | undefined): value is RichLessonContract {
  return Boolean(value && 'schemaVersion' in value && value.schemaVersion === 'campus-hub-lecture/v2');
}

function referenceKey(parts: string[], index: number) {
  const stem = parts.join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const suffix = `-image-${index + 1}`;
  return `${(stem || 'lecture').slice(0, 48 - suffix.length)}${suffix}`;
}

export function getLectureImages(lesson: LessonContract | null | undefined): LectureImageReference[] {
  if (!lesson) return [];
  if (!isRichLesson(lesson)) {
    return lesson.sections.map((section) => ({
      key: section.id,
      title: section.image.title,
      caption: section.image.caption,
      location: section.image.location,
      alt: section.image.alt,
    }));
  }

  const references: LectureImageReference[] = [];
  const addBlocks = (blocks: LectureBlock[], parts: string[]) => {
    blocks.forEach((block) => {
      if (block.type !== 'image') return;
      const index = references.length;
      references.push({
        key: referenceKey(parts, index),
        title: block.caption || block.alt || `Source image ${index + 1}`,
        caption: block.caption || block.alt,
        location: block.sourceLocation || block.src,
        alt: block.alt,
      });
    });
  };

  lesson.sections.forEach((section) => {
    addBlocks(section.content, [section.id]);
    section.subsections?.forEach((subsection) => addBlocks(subsection.content, [section.id, subsection.id]));
  });
  return references;
}

export function lectureTitle(lesson: LessonContract) {
  return isRichLesson(lesson) ? lesson.meta.title : lesson.lecture.title;
}

export function lectureSummary(lesson: LessonContract) {
  if (!isRichLesson(lesson)) return lesson.lecture.summary;
  if (lesson.meta.subtitle) return lesson.meta.subtitle;
  if (Array.isArray(lesson.summary)) return lesson.summary.join(' ');
  return lesson.summary || `A structured lecture with ${lesson.sections.length} sections.`;
}
