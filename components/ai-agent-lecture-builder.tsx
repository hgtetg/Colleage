'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clipboard,
  Download,
  ExternalLink,
  FileArchive,
  FileJson,
  FileText,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  Palette,
  Search,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { zipSync } from 'fflate';
import { useEffect, useMemo, useState } from 'react';
import AcademicShell from '@/components/academic-shell';
import type { CampusState } from '@/lib/campus-db';
import { getLectureImages, type LessonContract } from '@/lib/lecture-contract';

type BuilderStep = 'agent' | 'files' | 'images' | 'design';
type SourceImage = {
  sourceLocation: string;
  fileName: string;
  contentType: string;
  url: string;
  origin?: 'source' | 'google';
  referenceKey?: string;
  searchSuggestions?: string;
};
type Draft = {
  id: string;
  subjectId: string;
  agent: string;
  lectureFileName: string | null;
  agentFileName: string | null;
  design: string;
  imageManifest: SourceImage[];
  lesson: LessonContract | null;
  imageSelections: Record<string, string>;
  status: string;
};

const agents = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    note: 'Best for a balanced first draft and clean learning structure.',
    url: 'https://chatgpt.com/',
  },
  {
    id: 'claude',
    name: 'Claude',
    note: 'Helpful for long source material and thoughtful explanations.',
    url: 'https://claude.ai/new',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    note: 'Useful when your lecture source includes mixed media or research.',
    url: 'https://gemini.google.com/app',
  },
];

const designs = [
  {
    id: 'atelier',
    name: 'Atelier',
    label: 'Editorial and warm',
    text: 'Cream canvas, cobalt notes, and a focused reading rhythm.',
  },
  {
    id: 'midnight',
    name: 'Midnight lab',
    label: 'Focused and technical',
    text: 'A deep ink interface with bright, low-distraction study cues.',
  },
  {
    id: 'citrus',
    name: 'Citrus studio',
    label: 'Clear and energetic',
    text: 'Fresh green highlights for an upbeat, workshop-style lesson.',
  },
];

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || /^\s*</.test(text)) {
      throw new Error(response.status === 413
        ? 'The lecture upload is too large for this deployment. Use a smaller source file or fewer pages.'
        : `Campus Hub returned an unexpected HTML response (HTTP ${response.status}). Please refresh and try again.`);
    }
    throw new Error(`Campus Hub returned an invalid response (HTTP ${response.status}). Please try again.`);
  }
}

function lectureJsonContract() {
  return {
    _instructions: 'Delete this key and imageLocationReference in the final output. Replace every bracketed value with source-derived content. Optional fields may be omitted. Content type must be paragraph, list, quote, code, image, table, formula, example, or definition.',
    schemaVersion: 'campus-hub-lecture/v2',
    imageLocationReference: {
      pdf: 'Use the rendered page path media/page-001.jpg through the final source page, up to media/page-060.jpg. The number is the original PDF page number.',
      powerpoint: 'Use the exact embedded-image path, for example ppt/media/image1.png.',
      word: 'Use the exact embedded-image path, for example word/media/image1.jpeg.',
      directImage: 'Use the exact uploaded filename, for example concept-map.png.',
      rule: 'Never invent a location or use a web URL. Every image location must exist in the attached lecture source.',
    },
    meta: {
      title: '[Lecture title derived from the source]',
      subtitle: '[One-line subtitle, optional]',
      course: '[Course or module, optional]',
      instructor: '[Instructor, optional]',
      date: '[Lecture date, optional]',
      duration_minutes: 60,
    },
    objectives: ['[What the learner will understand or be able to do]'],
    toc_label: 'Contents',
    sections: [
      {
        id: 'short-section-id',
        heading: '[Section heading]',
        intro: '[Optional section introduction]',
        content: [
          { type: 'paragraph', text: '[Body text]' },
          { type: 'list', style: 'bulleted', items: ['[Point one]', '[Point two]'] },
          { type: 'quote', text: '[Quoted line]', attribution: '[Source, optional]' },
          { type: 'code', language: '[Language, optional]', code: '[Exact code]' },
          { type: 'image', src: 'media/page-001.jpg', title: '[Image title]', alt: '[Accessible description]', caption: '[Image caption, optional]' },
          { type: 'table', headers: ['[Column A]', '[Column B]'], rows: [['[Cell A]', '[Cell B]']] },
          { type: 'formula', text: '[Formula]', note: '[Explanation, optional]' },
          { type: 'example', title: '[Example title, optional]', text: '[Worked example]' },
          { type: 'definition', term: '[Term]', text: '[Definition]' },
        ],
        key_points: ['[Short recap point]'],
        subsections: [{
          id: 'short-subsection-id',
          heading: '[Subsection heading]',
          content: [{ type: 'paragraph', text: '[Subsection content]' }],
          key_points: ['[Optional subsection recap]'],
        }],
      },
    ],
    key_terms: [{ term: '[Important term]', definition: '[Definition]' }],
    summary: ['[Closing summary paragraph]'],
    further_reading: [{ title: '[Source-referenced resource]', url: 'https://example.com' }],
  };
}

async function renderPdfAsImageArchive(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;
  const pages: Record<string, Uint8Array> = {};

  try {
    const pageCount = Math.min(pdfDocument.numPages, 60);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const naturalViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1200 / naturalViewport.width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Your browser could not prepare the PDF pages.');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error('A PDF page could not be converted into an image.')),
          'image/jpeg',
          0.8,
        );
      });
      pages[`media/page-${String(pageNumber).padStart(3, '0')}.jpg`] = new Uint8Array(await blob.arrayBuffer());
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  const archive = zipSync(pages, { level: 6 });
  const bytes = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
  const baseName = file.name.replace(/\.pdf$/i, '').replace(/[^a-z0-9._-]+/gi, '-');
  return new File([bytes], `${baseName || 'lecture'}-pdf-pages.zip`, { type: 'application/zip' });
}

export default function AiAgentLectureBuilder({ step }: { step: BuilderStep }) {
  const [state, setState] = useState<CampusState | null>(null);
  const [subjectId, setSubjectId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const index = parts.indexOf('subjects');
    const detectedSubjectId = index >= 0 ? (parts[index + 1] ?? '') : '';
    setSubjectId(detectedSubjectId);
    void (async () => {
      try {
        const campusResponse = await fetch('/api/campus', { cache: 'no-store' });
        const campus = (await safeJson(campusResponse)) as CampusState & { error?: string };
        if (!campusResponse.ok) throw new Error(campus.error || 'Unable to open the lecture builder.');
        if (!campus.viewer) {
          window.location.assign('/signin');
          return;
        }
        setState(campus);
        const draftResponse = await fetch(
          `/api/lecture-builder?subjectId=${encodeURIComponent(detectedSubjectId)}`,
          { cache: 'no-store' },
        );
        const draftData = await safeJson(draftResponse);
        if (!draftResponse.ok) throw new Error(String(draftData.error || 'Unable to open the lecture draft.'));
        setDraft((draftData.draft as Draft | null) ?? null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to open the lecture builder.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const subject = state?.subjects.find((item) => item.id === subjectId);
  const basePath = `/app/subjects/${encodeURIComponent(subjectId)}/add-lecture/ai-agents`;
  const shellProps = {
    courseName: state?.course.name,
    courseMeta: state ? `${state.course.yearLabel} · ${state.course.sectionLabel}` : undefined,
    viewerInitials: state?.viewer?.initials ?? 'CH',
  };

  if (loading)
    return (
      <AcademicShell {...shellProps}>
        <section className="portal-state">
          <span className="portal-loader" />
          <h1>Preparing your AI-agent workspace</h1>
          <p>Loading your subject and saved draft…</p>
        </section>
      </AcademicShell>
    );

  if (!state || !subject || error)
    return (
      <AcademicShell {...shellProps}>
        <section className="portal-state">
          <Bot size={30} />
          <h1>{error || 'Subject not found'}</h1>
          <p>
            Only the course representative can build and publish a lecture. You can return to the subject to continue learning.
          </p>
          <a href={subjectId ? `/app/subjects/${encodeURIComponent(subjectId)}` : '/app/subjects'}>
            Return to subjects
          </a>
        </section>
      </AcademicShell>
    );

  return (
    <AcademicShell {...shellProps}>
      <section className="agent-builder">
        <a className="portal-back" href={`/app/subjects/${encodeURIComponent(subject.id)}`}>
          <ArrowLeft size={15} /> {subject.name}
        </a>
        <BuilderIntro subject={subject} step={step} basePath={basePath} />
        {step === 'agent' && (
          <AgentStep
            subject={subject}
            basePath={basePath}
            initialAgent={draft?.agent ?? ''}
            onDraft={setDraft}
          />
        )}
        {step === 'files' && <FilesStep basePath={basePath} draft={draft} onDraft={setDraft} />}
        {step === 'images' && (
          <ImagesStep
            key={`${draft?.id ?? 'empty'}-${draft?.lectureFileName ?? 'no-source'}`}
            basePath={basePath}
            draft={draft}
            onDraft={setDraft}
          />
        )}
        {step === 'design' && <DesignStep subject={subject} basePath={basePath} draft={draft} onDraft={setDraft} />}
      </section>
    </AcademicShell>
  );
}

function BuilderIntro({
  subject,
  step,
  basePath,
}: {
  subject: CampusState['subjects'][number];
  step: BuilderStep;
  basePath: string;
}) {
  const steps: Array<{ id: BuilderStep; label: string; href: string }> = [
    { id: 'agent', label: 'Agent', href: basePath },
    { id: 'files', label: 'AI JSON', href: `${basePath}/files` },
    { id: 'images', label: 'Images', href: `${basePath}/images` },
    { id: 'design', label: 'Design', href: `${basePath}/design` },
  ];
  const active = steps.findIndex((item) => item.id === step);
  return (
    <header className="agent-builder-intro">
      <div>
        <span className="portal-kicker">AI AGENT STUDIO · {subject.code}</span>
        <h1>Build a lecture that feels made for your class.</h1>
        <p>Prepare the JSON with your agent, bring it back, then let Campus Hub extract and match the real lecture images.</p>
      </div>
      <nav className="agent-steps" aria-label="Lecture creation steps">
        {steps.map((item, index) => (
          <a
            className={index === active ? 'active' : index < active ? 'complete' : ''}
            href={index <= active ? item.href : '#next-step'}
            key={item.id}
            aria-current={index === active ? 'step' : undefined}
          >
            <span>{index < active ? <Check size={13} /> : index + 1}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function AgentStep({
  subject,
  basePath,
  initialAgent,
  onDraft,
}: {
  subject: CampusState['subjects'][number];
  basePath: string;
  initialAgent: string;
  onDraft: (draft: Draft) => void;
}) {
  const [agent, setAgent] = useState(initialAgent);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = agents.find((item) => item.id === agent);
  const prompt = useMemo(
    () => `Read the entire attached lecture source and complete the attached Campus Hub v2 JSON template. The Campus Hub subject ${subject.name} (${subject.code}) is only the publishing destination; it must never override the source topic. Determine the actual title, course, terminology, objectives, sections, subsections, glossary, summary, and metadata from the source. Preserve every meaningful concept, explanation, definition, example, quote, formula, code sample, table, data point, and important image; reorganize logically and merge repetition without losing information. Use only the nine content types defined in the template and remove _instructions, imageLocationReference, and all placeholder examples from the final object. Do not extract, embed, encode, recreate, or download image files. For each important source image, create an image block with exactly four useful fields: src is the exact source location, title is a short image title, alt is an accessible visual description, and caption explains why the image matters. For a PDF, use media/page-001.jpg through the final source page, up to media/page-060.jpg, with the three-digit original page number. For PowerPoint use exact ppt/media paths, for Word use exact word/media paths, and for a direct image use its exact filename. Never invent facts, citations, links, or image paths. Before finishing, compare the JSON against the source page by page and add anything omitted. Your entire response must be exactly one valid raw JSON object whose first character is { and last character is }. Do not create or return a ZIP, HTML template, schema file, Markdown file, sample, explanation, warning, greeting, code fence, or any text outside the completed JSON. If the source topic differs from ${subject.name}, build the lecture from the source anyway without refusing or asking a question.`,
    [subject.code, subject.name],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Copy was blocked by the browser. Select the prompt and copy it manually.');
    }
  }

  function downloadContract() {
    const blob = new Blob([JSON.stringify(lectureJsonContract(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campus-hub-lecture-schema-v2.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function continueToFiles() {
    if (!selected) {
      setError('Choose an AI agent first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'start', subjectId: subject.id, agent }),
      });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to save the chosen agent.'));
      onDraft(result.draft as Draft);
      window.location.assign(`${basePath}/files`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the chosen agent.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-builder-card agent-choice-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><Bot size={16} /> Step 1 · Choose your AI agent</span>
        <h2>Choose where the lecture JSON will be prepared.</h2>
        <p>After you choose an agent, Campus Hub reveals the two items you must take with your lecture file.</p>
        <p><strong>Your uploaded source decides the lecture topic.</strong> {subject.name} is only where Campus Hub will publish the finished lecture.</p>
      </div>
      <div className="agent-toggle" role="radiogroup" aria-label="Choose your AI agent">
        {agents.map((item) => (
          <button
            type="button"
            role="radio"
            aria-checked={agent === item.id}
            className={agent === item.id ? 'selected' : ''}
            key={item.id}
            onClick={() => setAgent(item.id)}
          >
            <span>{item.name.slice(0, 1)}</span>
            <strong>{item.name}</strong>
            {agent === item.id && <CheckCircle2 size={17} />}
          </button>
        ))}
      </div>
      {selected ? <div className="agent-instructions">
        <div className="agent-instructions-title">
          <span className="agent-count">01</span>
          <div>
            <h3>Your {selected.name} instructions</h3>
            <p>{selected.note}</p>
          </div>
        </div>
        <div className="agent-handoff-actions">
          <button type="button" className="agent-handoff-button template" onClick={downloadContract}>
            <span>A</span><FileJson size={23} /><div><small>JSON TEMPLATE</small><strong>Download template file</strong><p>Attach this file to {selected.name} without editing it.</p></div><Download size={18} />
          </button>
          <button type="button" className="agent-handoff-button prompt" onClick={copyPrompt}>
            <span>B</span><Clipboard size={23} /><div><small>AI INSTRUCTIONS</small><strong>{copied ? 'Prompt copied' : 'Copy agent prompt'}</strong><p>Paste it into the same conversation with both files.</p></div>{copied ? <Check size={18} /> : <Clipboard size={18} />}
          </button>
        </div>
        <ol className="agent-task-list">
          <li><span>1</span><div><strong>Open {selected.name}</strong><p>Use <a href={selected.url} target="_blank" rel="noreferrer">the {selected.name} website <ExternalLink size={13} /></a>.</p></div></li>
          <li><span>2</span><div><strong>Attach two files</strong><p>Add your original lecture file and the downloaded JSON template.</p></div></li>
          <li><span>3</span><div><strong>Paste the prompt</strong><p>The agent fills the JSON with all lecture content and the exact locations of important images.</p></div></li>
          <li><span>4</span><div><strong>Download the completed JSON</strong><p>The agent must return one JSON file only. Campus Hub—not the agent—extracts the images later.</p></div></li>
        </ol>
      </div> : <div className="agent-awaiting-choice"><Bot size={21} /><div><strong>Select an agent to continue</strong><p>The download and copy buttons will appear here.</p></div></div>}
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={`/app/subjects/${encodeURIComponent(subject.id)}/add-lecture`}>Choose another method</a>
        <button className="portal-primary" type="button" onClick={continueToFiles} disabled={busy || !selected}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: import AI JSON'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function FilesStep({
  basePath,
  draft,
  onDraft,
}: {
  basePath: string;
  draft: Draft | null;
  onDraft: (draft: Draft) => void;
}) {
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [pastedJson, setPastedJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = Boolean(draft?.agentFileName && draft?.lesson);

  function usePastedJson() {
    const raw = pastedJson
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    try {
      const parsed = JSON.parse(raw);
      const file = new File(
        [JSON.stringify(parsed, null, 2)],
        'campus-hub-ai-output.json',
        { type: 'application/json' },
      );
      setAgentFile(file);
      setError('');
    } catch {
      setError('Paste one complete JSON object from the AI agent before using it.');
    }
  }

  async function saveJson() {
    if (!draft) {
      setError('Choose an AI agent first.');
      return;
    }
    if (!agentFile) {
      if (ready) {
        window.location.assign(`${basePath}/images`);
        return;
      }
      setError('Choose the completed JSON file returned by your AI agent.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('action', 'upload_agent_json');
      form.append('draftId', draft.id);
      form.append('agentFile', agentFile);
      const response = await fetch('/api/lecture-builder', { method: 'POST', body: form });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to validate the AI JSON.'));
      onDraft(result.draft as Draft);
      window.location.assign(`${basePath}/images`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to validate the AI JSON.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-builder-card files-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><FileJson size={16} /> Step 2 · Import the AI result</span>
        <h2>Bring back the completed JSON file.</h2>
        <p>Campus Hub checks the structure and saves all lecture content. The original lecture file comes next, where the website extracts its images.</p>
      </div>
      <div className="upload-grid single-upload">
        <FilePicker
          icon={FileArchive}
          eyebrow="AI AGENT OUTPUT"
          title="Completed lecture JSON"
          text="Use the single .json file created by the AI agent from your lecture and the Campus Hub template."
          file={agentFile}
          savedName={draft?.agentFileName}
          onChange={setAgentFile}
          accept=".json,application/json"
        />
      </div>
      <div className="json-paste-option">
        <div>
          <span><FileJson size={17} /> Did the agent display JSON instead of downloading it?</span>
          <p>Paste the raw response here and Campus Hub will create the required <code>.json</code> file for this step.</p>
        </div>
        <textarea
          value={pastedJson}
          onChange={(event) => setPastedJson(event.target.value)}
          placeholder={'{\n  "schemaVersion": "campus-hub-lecture/v2",\n  "meta": { ... },\n  "sections": [ ... ]\n}'}
          aria-label="Paste the AI agent JSON response"
        />
        <button className="portal-secondary" type="button" onClick={usePastedJson} disabled={!pastedJson.trim()}>
          <FileJson size={16} /> Use pasted JSON
        </button>
      </div>
      <div className="upload-assurance"><CheckCircle2 size={17} /> This step imports content and image locations only. No lecture image is extracted by the AI agent.</div>
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={basePath}><ArrowLeft size={16} /> Back</a>
        <button className="portal-primary" type="button" onClick={saveJson} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: import lecture & choose images'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function FilePicker({
  icon: Icon,
  eyebrow,
  title,
  text,
  file,
  savedName,
  onChange,
  accept,
}: {
  icon: typeof FileText;
  eyebrow: string;
  title: string;
  text: string;
  file: File | null;
  savedName: string | null | undefined;
  onChange: (file: File | null) => void;
  accept: string;
}) {
  const fileName = file?.name ?? savedName;
  return (
    <label className={fileName ? 'file-picker has-file' : 'file-picker'}>
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <span className="file-picker-icon"><Icon size={22} /></span>
      <small>{eyebrow}</small>
      <strong>{title}</strong>
      <p>{fileName ? <><CheckCircle2 size={15} /> {fileName}</> : text}</p>
      <span className="file-picker-button">{fileName ? 'Replace file' : 'Choose file'}</span>
    </label>
  );
}

function DesignStep({
  subject,
  basePath,
  draft,
  onDraft,
}: {
  subject: CampusState['subjects'][number];
  basePath: string;
  draft: Draft | null;
  onDraft: (draft: Draft) => void;
}) {
  const [design, setDesign] = useState(draft?.design ?? 'atelier');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createLecture() {
    if (!draft?.lectureFileName || !draft.agentFileName || !draft.lesson)
      return setError('Import the completed JSON and lecture source before creating the lecture.');
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update_design', draftId: draft.id, design }),
      });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to save the design.'));
      onDraft(result.draft as Draft);
      const publishResponse = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish', draftId: draft.id }),
      });
      const publishResult = await safeJson(publishResponse);
      if (!publishResponse.ok) throw new Error(String(publishResult.error || 'Unable to create the lecture.'));
      window.location.assign(`/app/subjects/${encodeURIComponent(subject.id)}/lectures/${encodeURIComponent(String(publishResult.lectureId))}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the design.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agent-builder-card design-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><Palette size={16} /> Step 4 · Choose the final design</span>
        <h2>Set the visual direction for {subject.code}.</h2>
        <p>The design carries into the published lecture and remains comfortable on every screen size.</p>
      </div>
      <div className="design-grid" role="radiogroup" aria-label="Choose a lecture design">
        {designs.map((item) => (
          <button
            type="button"
            role="radio"
            aria-checked={design === item.id}
            className={`design-option design-preview-${item.id}${design === item.id ? ' selected' : ''}`}
            key={item.id}
            onClick={() => setDesign(item.id)}
          >
            <span className="design-preview"><i /><i /><i /></span>
            <span className="design-option-copy"><small>{item.label}</small><strong>{item.name}</strong><em>{item.text}</em></span>
            {design === item.id && <CheckCircle2 size={19} />}
          </button>
        ))}
      </div>
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={`${basePath}/images`}><ArrowLeft size={16} /> Back to images</a>
        <button className="portal-primary create-lecture-button" type="button" onClick={createLecture} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Create interactive lecture
        </button>
      </div>
    </div>
  );
}

function ImagesStep({
  basePath,
  draft,
  onDraft,
}: {
  basePath: string;
  draft: Draft | null;
  onDraft: (draft: Draft) => void;
}) {
  const images = getLectureImages(draft?.lesson);
  const [lectureFile, setLectureFile] = useState<File | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>(
    () => Object.fromEntries(images.map((image) => [image.key, draft?.imageSelections[image.key] ?? image.location])),
  );
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function uploadLecture() {
    if (!draft?.lesson || !draft.agentFileName) {
      setError('Import and validate the AI-agent JSON first.');
      return;
    }
    if (!lectureFile) {
      if (draft.lectureFileName) return;
      setError('Choose the original lecture file so Campus Hub can extract its images.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sourceFile = lectureFile.type === 'application/pdf' || lectureFile.name.toLowerCase().endsWith('.pdf')
        ? await renderPdfAsImageArchive(lectureFile)
        : lectureFile;
      const form = new FormData();
      form.append('action', 'upload_source');
      form.append('draftId', draft.id);
      form.append('lectureFile', sourceFile);
      form.append('originalFileName', lectureFile.name);
      const response = await fetch('/api/lecture-builder', { method: 'POST', body: form });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to extract the lecture images.'));
      onDraft(result.draft as Draft);
      window.location.assign(`${basePath}/images`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to extract the lecture images.');
    } finally {
      setBusy(false);
    }
  }

  async function findGoogleAlternative(referenceKey: string) {
    if (!draft?.lectureFileName) {
      setError('Import the lecture file before requesting image alternatives.');
      return null;
    }
    setSearching((current) => [...current, referenceKey]);
    setError('');
    try {
      const response = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'search_google_image',
          draftId: draft.id,
          referenceKey,
          geminiApiKey: geminiApiKey.trim() || undefined,
        }),
      });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Gemini could not prepare an image alternative.'));
      const nextDraft = result.draft as Draft;
      onDraft(nextDraft);
      return nextDraft;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gemini could not prepare an image alternative.');
      return null;
    } finally {
      setSearching((current) => current.filter((key) => key !== referenceKey));
    }
  }

  async function findAllGoogleAlternatives() {
    if (!images.length) return;
    setBusy(true);
    try {
      for (const reference of images) {
        const hasAlternative = draft?.imageManifest.some(
          (candidate) => candidate.origin === 'google' && candidate.referenceKey === reference.key,
        );
        if (!hasAlternative) await findGoogleAlternative(reference.key);
      }
    } finally {
      setBusy(false);
    }
  }

  async function continueToDesign() {
    if (!draft?.lectureFileName || !draft.lesson) {
      setError('Import the original lecture file before continuing.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update_images', draftId: draft.id, imageSelections: selected }),
      });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to save the image choices.'));
      onDraft(result.draft as Draft);
      window.location.assign(`${basePath}/design`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the image choices.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-builder-card images-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><ImagePlus size={16} /> Step 3 · Extract and choose images</span>
        <h2>Let Campus Hub find every image named in the JSON.</h2>
        <p>Import the original lecture. Campus Hub extracts the exact images at the recorded locations, then Gemini can create additional grounded alternatives using Google Search for each image title.</p>
      </div>

      <div className="image-source-workspace">
        <FilePicker
          icon={FileText}
          eyebrow="ORIGINAL LECTURE"
          title="Import lecture file"
          text="Use PDF, PPTX, DOCX, ZIP, or one image. Campus Hub—not the AI agent—extracts the images."
          file={lectureFile}
          savedName={draft?.lectureFileName}
          onChange={setLectureFile}
          accept=".pdf,application/pdf,.pptx,.docx,.zip,.png,.jpg,.jpeg,.webp,.gif"
        />
        <div className="image-extraction-status">
          <span><ImagePlus size={19} /> SOURCE IMAGE EXTRACTION</span>
          <h3>{draft?.lectureFileName ? `${draft.imageManifest.filter((image) => image.origin !== 'google').length} source images ready` : 'Waiting for the lecture file'}</h3>
          <p>The saved JSON currently requests {images.length} important {images.length === 1 ? 'image' : 'images'} by exact location.</p>
          <button className="portal-primary" type="button" onClick={uploadLecture} disabled={busy || (!lectureFile && Boolean(draft?.lectureFileName))}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}
            {draft?.lectureFileName ? 'Replace & extract again' : 'Import & extract images'}
          </button>
        </div>
      </div>

      {draft?.lectureFileName && images.length > 0 && (
        <div className="gemini-image-search-panel">
          <div><span><Sparkles size={17} /> GEMINI + GOOGLE SEARCH</span><h3>Add grounded visual alternatives</h3><p>Campus Hub keeps the exact extracted image in every slide. Add your Gemini API key only when the site does not already have one connected; it is used for this request and is never saved.</p></div>
          <label><KeyRound size={16} /><input type="password" value={geminiApiKey} onChange={(event) => setGeminiApiKey(event.target.value)} placeholder="Optional Gemini API key" autoComplete="off" /></label>
          <button className="portal-secondary" type="button" onClick={findAllGoogleAlternatives} disabled={busy || searching.length > 0}>
            {busy || searching.length ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />} Find alternatives for all titles
          </button>
        </div>
      )}

      {draft?.lectureFileName && images.length ? (
        <div className="image-selection-list">
          {images.map((imageReference, groupIndex) => {
            const candidates = draft.imageManifest.filter((candidate) =>
              candidate.sourceLocation === imageReference.location ||
              (candidate.origin === 'google' && candidate.referenceKey === imageReference.key),
            );
            const suggestions = [...new Set(candidates.map((candidate) => candidate.searchSuggestions).filter(Boolean))] as string[];
            return (
            <section className="image-selection-group source-image-group" key={imageReference.key}>
              <div className="image-selection-head"><span>{String(groupIndex + 1).padStart(2, '0')}</span><div><h3>{imageReference.title}</h3><p>{imageReference.caption}</p></div><small>Location: {imageReference.location}</small></div>
              <div className="image-slider" aria-label={`Select the image for ${imageReference.title}`}>
                {candidates.map((image) => (
                  <button
                    type="button"
                    className={`${selected[imageReference.key] === image.sourceLocation ? 'source-image-choice selected' : 'source-image-choice'}${image.origin === 'google' ? ' google-image-choice' : ''}`}
                    key={image.sourceLocation}
                    onClick={() => setSelected((current) => ({ ...current, [imageReference.key]: image.sourceLocation }))}
                    aria-pressed={selected[imageReference.key] === image.sourceLocation}
                  >
                    <img src={image.url} alt={imageReference.title} />
                    <span>{selected[imageReference.key] === image.sourceLocation ? <><Check size={15} /> Selected</> : image.origin === 'google' ? 'Gemini + Google alternative' : 'Extracted lecture image'}</span>
                  </button>
                ))}
                <button className="google-search-more" type="button" onClick={() => void findGoogleAlternative(imageReference.key)} disabled={searching.includes(imageReference.key)}>
                  {searching.includes(imageReference.key) ? <LoaderCircle className="spin" size={22} /> : <Search size={22} />}<strong>Find another</strong><span>Gemini + Google Search</span>
                </button>
              </div>
              {suggestions.map((html, index) => <div className="google-search-suggestions" key={index} dangerouslySetInnerHTML={{ __html: html }} />)}
            </section>
          )})}
        </div>
      ) : draft?.lectureFileName && draft?.lesson ? (
        <div className="contract-empty"><CheckCircle2 size={20} /><div><strong>This lecture does not request images.</strong><p>The original source is saved. You can continue to design the complete text, table, formula, code, glossary, and summary experience.</p></div></div>
      ) : (
        <div className="contract-empty"><FileArchive size={20} /><div><strong>The original lecture is still needed.</strong><p>Import it above. Campus Hub will verify every JSON location and extract the matching image itself.</p></div></div>
      )}
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={`${basePath}/files`}><ArrowLeft size={16} /> Back to AI JSON</a>
        <button className="portal-primary" type="button" onClick={continueToDesign} disabled={busy || !draft?.lectureFileName}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: choose design'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}
