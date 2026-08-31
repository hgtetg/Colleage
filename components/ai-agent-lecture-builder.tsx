'use client';

/* oxlint-disable next/no-html-link-for-pages -- Native links avoid a Vinext production navigation crash. */

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Clipboard,
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
type Draft = {
  id: string;
  subjectId: string;
  agent: string;
  lectureFileName: string | null;
  agentFileName: string | null;
  design: string;
  imageChoices: number[];
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

const imageGroups = [
  { title: 'Concept opener', choices: [0, 1, 2] },
  { title: 'How it works', choices: [3, 4, 5] },
  { title: 'Pattern in practice', choices: [6, 7, 8] },
  { title: 'Key takeaway', choices: [0, 4, 8] },
];

function safeJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
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
    () => `You are helping create an accurate university lecture for ${subject.name} (${subject.code}). Read the attached source file. Return valid JSON only in this shape: {"title":"...","summary":"...","sections":[{"title":"...","body":"...","keyPoint":"..."}]}. Create 4–6 concise sections, explain terms plainly, include one worked example, highlight practical trade-offs, and end with a short application task. Do not invent facts that are not supported by the source.`,
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
        <p>Select where you want to create the lesson outline. The next steps bring the finished output back into Campus Hub.</p>
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
          <button type="button" onClick={copyPrompt}>
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
            {copied ? 'Prompt copied' : 'Copy prompt'}
          </button>
        </div>
        <ol className="agent-task-list">
          <li><span>1</span><div><strong>Copy the prompt</strong><p>Use the copy button above to keep the request complete.</p></div></li>
          <li><span>2</span><div><strong>Paste it with your lecture file</strong><p>Open <a href={selected.url} target="_blank" rel="noreferrer">{selected.name} <ExternalLink size={13} /></a>, attach the source file, then send the prompt.</p></div></li>
          <li><span>3</span><div><strong>Download the agent output</strong><p>Save the result as JSON, TXT, or Markdown when possible.</p></div></li>
          <li><span>4</span><div><strong>Upload both files in the next step</strong><p>Campus Hub securely stores your source and the generated output with this lecture draft.</p></div></li>
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
        <h2>Upload the two files that power the lesson.</h2>
        <p>They remain private to your course draft. Each file can be up to 20 MB.</p>
      </div>
      <div className="upload-grid">
        <FilePicker
          icon={FileText}
          eyebrow="SOURCE FILE"
          title="Your lecture file"
          text="The slides, notes, PDF, or document you gave the agent."
          file={lectureFile}
          savedName={draft?.lectureFileName}
          onChange={setLectureFile}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
        />
        <FilePicker
          icon={FileArchive}
          eyebrow="AGENT OUTPUT"
          title="Your AI-agent output"
          text="Prefer the JSON, TXT, or Markdown file generated from the prompt."
          file={agentFile}
          savedName={draft?.agentFileName}
          onChange={setAgentFile}
          accept=".json,.txt,.md,.pdf,.doc,.docx"
        />
      </div>
      <div className="upload-assurance"><CheckCircle2 size={17} /> Files are attached to this draft only and are never shown in the public lecture.</div>
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
  const initial = imageGroups.map((group, index) => draft?.imageChoices[index] ?? group.choices[0]);
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function createLecture() {
    if (!draft) return setError('Choose a design before creating the lecture.');
    setBusy(true);
    setError('');
    try {
      const imagesResponse = await fetch('/api/lecture-builder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'update_images', draftId: draft.id, imageChoices: selected }),
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
        <h2>Choose one image for each moment.</h2>
        <p>Swipe through each image strip and pick the image that best supports the section. These visuals will appear in the finished lecture.</p>
      </div>
      <div className="image-selection-list">
        {imageGroups.map((group, groupIndex) => (
          <section className="image-selection-group" key={group.title}>
            <div className="image-selection-head"><span>{String(groupIndex + 1).padStart(2, '0')}</span><h3>{group.title}</h3><small>Swipe to compare →</small></div>
            <div className="image-slider" aria-label={`Select an image for ${group.title}`}>
              {group.choices.map((image) => (
                <button
                  type="button"
                  className={`image-choice image-tile-${image}${selected[groupIndex] === image ? ' selected' : ''}`}
                  key={image}
                  onClick={() => setSelected((current) => current.map((item, index) => index === groupIndex ? image : item))}
                  aria-pressed={selected[groupIndex] === image}
                >
                  <span>{selected[groupIndex] === image ? <Check size={16} /> : 'Select'}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
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
