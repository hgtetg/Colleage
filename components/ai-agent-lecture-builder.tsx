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
  FileText,
  ImagePlus,
  LoaderCircle,
  Palette,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AcademicShell from '@/components/academic-shell';
import type { CampusState } from '@/lib/campus-db';

type BuilderStep = 'agent' | 'files' | 'design' | 'images';
type SourceImage = {
  sourceLocation: string;
  fileName: string;
  contentType: string;
  url: string;
};
type LessonSection = {
  id: string;
  title: string;
  body: string;
  keyPoint?: string;
  image: { title: string; caption: string; location: string; alt: string };
};
type LessonContract = {
  schemaVersion: 'campus-hub-lecture/v1';
  lecture: { title: string; summary: string; estimatedMinutes: number };
  sections: LessonSection[];
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

function safeJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function lectureJsonContract(subject: CampusState['subjects'][number]) {
  return {
    schemaVersion: 'campus-hub-lecture/v1',
    contractNote: 'Replace every bracketed value. Return this completed object as valid JSON only; do not add prose or Markdown.',
    imageLocationReference: {
      powerpoint: 'Use the exact embedded-image path, for example ppt/media/image1.png.',
      word: 'Use the exact embedded-image path, for example word/media/image1.jpeg.',
      directImage: 'Use the exact uploaded filename, for example concept-map.png.',
      rule: 'Never invent a location or use a web URL. Every image location must exist in the attached lecture source.',
    },
    lecture: {
      title: `[Clear ${subject.name} lecture title]`,
      summary: '[One concise summary of what students will learn.]',
      estimatedMinutes: 18,
    },
    sections: [
      {
        id: 'foundation',
        title: '[First learning moment]',
        body: '[Explain the key concept using only the attached source.]',
        keyPoint: '[One memorable takeaway.]',
        image: {
          title: '[Image title]',
          caption: '[What this source image shows and why it matters.]',
          location: 'ppt/media/image1.png',
          alt: '[Short accessible description of the image.]',
        },
      },
      {
        id: 'worked-example',
        title: '[Second learning moment]',
        body: '[Explain a worked example from the attached source.]',
        keyPoint: '[One memorable takeaway.]',
        image: {
          title: '[Image title]',
          caption: '[What this source image shows and why it matters.]',
          location: 'ppt/media/image2.png',
          alt: '[Short accessible description of the image.]',
        },
      },
      {
        id: 'application',
        title: '[Third learning moment]',
        body: '[Give a practical application or comparison.]',
        keyPoint: '[One memorable takeaway.]',
        image: {
          title: '[Image title]',
          caption: '[What this source image shows and why it matters.]',
          location: 'ppt/media/image3.png',
          alt: '[Short accessible description of the image.]',
        },
      },
    ],
  };
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
            initialAgent={draft?.agent ?? 'chatgpt'}
            onDraft={setDraft}
          />
        )}
        {step === 'files' && <FilesStep subject={subject} basePath={basePath} draft={draft} onDraft={setDraft} />}
        {step === 'design' && <DesignStep subject={subject} basePath={basePath} draft={draft} onDraft={setDraft} />}
        {step === 'images' && <ImagesStep subject={subject} basePath={basePath} draft={draft} onDraft={setDraft} />}
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
    { id: 'files', label: 'Files', href: `${basePath}/files` },
    { id: 'design', label: 'Design', href: `${basePath}/design` },
    { id: 'images', label: 'Images', href: `${basePath}/images` },
  ];
  const active = steps.findIndex((item) => item.id === step);
  return (
    <header className="agent-builder-intro">
      <div>
        <span className="portal-kicker">AI AGENT STUDIO · {subject.code}</span>
        <h1>Build a lecture that feels made for your class.</h1>
        <p>Bring your source material and an AI-agent output. Campus Hub turns them into a structured, interactive lesson.</p>
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
  const selected = agents.find((item) => item.id === agent) ?? agents[0];
  const prompt = useMemo(
    () => `Create an accurate university lecture for ${subject.name} (${subject.code}). I attached the lecture source and the Campus Hub JSON contract. Read both files. Return one completed JSON file only: preserve the exact schemaVersion and all field names from the contract; do not add prose, Markdown, remote URLs, or binary image data. Create 3–8 concise sections with a clear explanation, a key point, and one important source image each. For every image, fill title, caption, alt, and location. The location must be the exact embedded image path from the source: for PowerPoint use paths like ppt/media/image1.png; for Word use word/media/image1.png; for a direct image use its exact filename. Never invent an image location. Use only facts supported by the source.`,
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
    const blob = new Blob([JSON.stringify(lectureJsonContract(subject), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${subject.code.toLowerCase()}-campus-hub-lecture-contract.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function continueToFiles() {
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
        <h2>One prompt, your preferred workspace.</h2>
        <p>Download the JSON contract, then give it to your chosen agent together with the lecture source and the prompt below.</p>
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
      <div className="agent-instructions">
        <div className="agent-instructions-title">
          <span className="agent-count">01</span>
          <div>
            <h3>Your {selected.name} instructions</h3>
            <p>{selected.note}</p>
          </div>
        </div>
        <div className="prompt-box">
          <p>{prompt}</p>
          <div className="prompt-actions">
            <button type="button" onClick={downloadContract}>
              <Download size={16} /> Download JSON contract
            </button>
            <button type="button" onClick={copyPrompt}>
              {copied ? <Check size={16} /> : <Clipboard size={16} />}
              {copied ? 'Prompt copied' : 'Copy prompt'}
            </button>
          </div>
        </div>
        <ol className="agent-task-list">
          <li><span>1</span><div><strong>Download the JSON contract</strong><p>It is the exact lecture-web-page structure the agent must complete.</p></div></li>
          <li><span>2</span><div><strong>Attach all three inputs</strong><p>Open <a href={selected.url} target="_blank" rel="noreferrer">{selected.name} <ExternalLink size={13} /></a>, then attach your lecture source, the downloaded contract, and the copied prompt.</p></div></li>
          <li><span>3</span><div><strong>Download one completed JSON file</strong><p>Do not accept prose, a PDF, or Markdown. The completed contract must stay a JSON file.</p></div></li>
          <li><span>4</span><div><strong>Upload source + JSON here</strong><p>Campus Hub matches each JSON image location to the real image extracted from the lecture source.</p></div></li>
        </ol>
      </div>
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={`/app/subjects/${encodeURIComponent(subject.id)}/add-lecture`}>Choose another method</a>
        <button className="portal-primary" type="button" onClick={continueToFiles} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: upload files'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function FilesStep({
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
  const [lectureFile, setLectureFile] = useState<File | null>(null);
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = Boolean(draft?.lectureFileName && draft?.agentFileName);

  async function saveFiles() {
    if (!draft) {
      setError('Choose an AI agent first.');
      return;
    }
    if (!lectureFile || !agentFile) {
      if (ready) {
        window.location.assign(`${basePath}/design`);
        return;
      }
      setError('Choose both the lecture source and the AI-agent output.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('action', 'upload');
      form.append('draftId', draft.id);
      form.append('lectureFile', lectureFile);
      form.append('agentFile', agentFile);
      const response = await fetch('/api/lecture-builder', { method: 'POST', body: form });
      const result = await safeJson(response);
      if (!response.ok) throw new Error(String(result.error || 'Unable to save the files.'));
      onDraft(result.draft as Draft);
      window.location.assign(`${basePath}/design`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the files.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="agent-builder-card files-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><UploadCloud size={16} /> Step 2 · Bring the source back</span>
        <h2>Upload the source and its completed JSON contract.</h2>
        <p>Campus Hub extracts the source images, validates every image location in the JSON, and keeps both files private to this draft.</p>
      </div>
      <div className="upload-grid">
        <FilePicker
          icon={FileText}
          eyebrow="SOURCE FILE"
          title="Your lecture file"
          text="Use PPTX, DOCX, ZIP, or one image file. These formats let Campus Hub extract the real source images."
          file={lectureFile}
          savedName={draft?.lectureFileName}
          onChange={setLectureFile}
          accept=".pptx,.docx,.zip,.png,.jpg,.jpeg,.webp,.gif"
        />
        <FilePicker
          icon={FileArchive}
          eyebrow="AGENT OUTPUT"
          title="Your AI-agent output"
          text="The one completed .json file the AI agent returned from the Campus Hub contract."
          file={agentFile}
          savedName={draft?.agentFileName}
          onChange={setAgentFile}
          accept=".json,application/json"
        />
      </div>
      <div className="upload-assurance"><CheckCircle2 size={17} /> Original files remain private. Only the image titles, captions, and selected extracted images appear in the published lecture.</div>
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={basePath}><ArrowLeft size={16} /> Back</a>
        <button className="portal-primary" type="button" onClick={saveFiles} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: choose design'} <ArrowRight size={17} />
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
  async function saveDesign() {
    if (!draft) return setError('Upload the two files before choosing a design.');
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
      window.location.assign(`${basePath}/images`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the design.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agent-builder-card design-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><Palette size={16} /> Step 3 · Choose the atmosphere</span>
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
        <a className="portal-secondary" href={`${basePath}/files`}><ArrowLeft size={16} /> Back</a>
        <button className="portal-primary" type="button" onClick={saveDesign} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : 'Next: select images'} <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function ImagesStep({
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
  const sections = draft?.lesson?.sections ?? [];
  const [selected, setSelected] = useState<Record<string, string>>(
    () => Object.fromEntries(sections.map((section) => [section.id, draft?.imageSelections[section.id] ?? section.image.location])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createLecture() {
    if (!draft) return setError('Choose a design before creating the lecture.');
    if (!sections.length || !draft.imageManifest.length) {
      setError('Upload a completed JSON contract and a source file with embedded images first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const imagesResponse = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update_images', draftId: draft.id, imageSelections: selected }),
      });
      const imagesResult = await safeJson(imagesResponse);
      if (!imagesResponse.ok) throw new Error(String(imagesResult.error || 'Unable to save the image choices.'));
      onDraft(imagesResult.draft as Draft);
      const publishResponse = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish', draftId: draft.id }),
      });
      const publishResult = await safeJson(publishResponse);
      if (!publishResponse.ok) throw new Error(String(publishResult.error || 'Unable to create the lecture.'));
      window.location.assign(`/app/subjects/${encodeURIComponent(subject.id)}/lectures/${encodeURIComponent(String(publishResult.lectureId))}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create the lecture.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="agent-builder-card images-step">
      <div className="agent-choice-copy">
        <span className="agent-eyebrow"><ImagePlus size={16} /> Step 4 · Shape the visual story</span>
        <h2>Confirm the real source image for every section.</h2>
        <p>The title and caption come directly from your AI-agent JSON. Campus Hub has extracted the images from your uploaded lecture source; keep the matched one or select another extracted image.</p>
      </div>
      {sections.length ? (
        <div className="image-selection-list">
          {sections.map((section, groupIndex) => (
            <section className="image-selection-group source-image-group" key={section.id}>
              <div className="image-selection-head"><span>{String(groupIndex + 1).padStart(2, '0')}</span><div><h3>{section.image.title}</h3><p>{section.image.caption}</p></div><small>Source: {section.image.location}</small></div>
              <div className="image-slider" aria-label={`Select the image for ${section.image.title}`}>
                {draft!.imageManifest.map((image) => (
                  <button
                    type="button"
                    className={selected[section.id] === image.sourceLocation ? 'source-image-choice selected' : 'source-image-choice'}
                    key={image.sourceLocation}
                    onClick={() => setSelected((current) => ({ ...current, [section.id]: image.sourceLocation }))}
                    aria-pressed={selected[section.id] === image.sourceLocation}
                  >
                    <img src={image.url} alt="" />
                    <span>{selected[section.id] === image.sourceLocation ? <><Check size={15} /> Selected source image</> : image.sourceLocation}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="contract-empty"><FileArchive size={20} /><div><strong>Your JSON contract is not ready yet.</strong><p>Go back and upload the original lecture source plus the completed JSON file from your AI agent.</p></div></div>
      )}
      <div className="creation-note"><Sparkles size={17} /><span>Ready to create: {subject.name} will be published as a responsive, interactive lecture.</span></div>
      {error && <p className="agent-form-error">{error}</p>}
      <div className="agent-builder-actions">
        <a className="portal-secondary" href={`${basePath}/design`}><ArrowLeft size={16} /> Back</a>
        <button className="portal-primary create-lecture-button" type="button" onClick={createLecture} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Create interactive lecture
        </button>
      </div>
    </div>
  );
}
