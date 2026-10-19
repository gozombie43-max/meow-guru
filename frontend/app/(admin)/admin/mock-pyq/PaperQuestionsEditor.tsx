"use client";

import { useEffect, useRef, useState } from "react";
import QuestionImage from "@/components/QuestionImage";
import { API_BASE } from "@/lib/api-base";
import { adminScopedUrl } from "@/lib/admin-exam-mode";
import { requestResponse } from "@/shared/api/request";
import styles from "./papers.module.css";

type Answer = string | number | (string | number)[] | { min: number; max: number };
type Translation = { question: string; options: string[]; solution: string };
type Question = Translation & {
  id: string; sectionKey?: string; questionType: string; correctAnswer: Answer;
  questionImage: string | null; translations?: { bn: Translation };
};
type Paper = { id: string; examSlug: string; title: string };
type PaperContent = { questions: Question[]; updatedAt: string | null; optionImageStatus?: Record<string, { en: boolean[]; bn?: boolean[] }> };
type ZipPreview = { questionCount: number; fileCount: number; images: { questionId: string; target: string; option?: string; language?: string; file: string; replaces: boolean }[] };
type ZipStatus = { stage: "idle" | "selected" | "validating" | "ready" | "uploading" | "success" | "error"; message: string; filename?: string; images?: ZipPreview["images"] };
const hasOptionImage = (value: string) => /!\[[^\]]*\]\([^)]+\)|\/api\/upload\/image\/|(?:https?:\/\/|\/(?:images|pyq-assets)\/)[^\s)]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#\s)]|$)/i.test(value);
async function read(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

export default function PaperQuestionsEditor({ paper, mode, onClose }: { paper: Paper; mode: "ssc" | "iit-jam"; onClose: () => void }) {
  const [content, setContent] = useState<PaperContent | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipPreview, setZipPreview] = useState<ZipPreview | null>(null);
  const [zipStatus, setZipStatus] = useState<ZipStatus>({ stage: "idle", message: "Choose a ZIP to begin." });
  const [zipOpen, setZipOpen] = useState(false);
  const [numericalDrafts, setNumericalDrafts] = useState<Record<string, string>>({});
  const operations = useRef<AbortController | null>(null);
  const base = adminScopedUrl(`${API_BASE}/api/mocktest/admin/slots/${encodeURIComponent(paper.id)}/questions?examSlug=${encodeURIComponent(paper.examSlug)}`, mode);

  useEffect(() => {
    const controller = new AbortController();
    operations.current = controller;
    requestResponse(base, { signal: controller.signal }).then(read).then((data: PaperContent) => {
      if (controller.signal.aborted) return;
      setContent(data); setQuestions(data.questions); setSelectedId(data.questions[0]?.id || "");
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load questions."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, revision]);

  const changed = questions.filter((q, index) => JSON.stringify(q) !== JSON.stringify(content?.questions[index]) || numericalDrafts[q.id] !== undefined);
  const dirty = changed.length > 0;
  useEffect(() => {
    if (!dirty && !uploading) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uploading]);

  const selected = questions.find(q => q.id === selectedId);
  const filtered = questions.filter(q => (!section || q.sectionKey === section) && `${q.id} ${q.question} ${q.translations?.bn.question || ""}`.toLowerCase().includes(search.toLowerCase()));
  const sections = [...new Set(questions.flatMap(q => q.sectionKey ? [q.sectionKey] : []))];
  const locked = saving || uploading;
  const zipBusy = zipStatus.stage === "validating" || zipStatus.stage === "uploading";
  const linkedQuestions = content?.questions.filter(q => q.questionImage).length || 0;
  const linkedOptions = content?.questions.reduce((count, q) => count + q.options.filter((option, index) => content.optionImageStatus?.[q.id]?.en[index] || hasOptionImage(option)).length + (q.translations?.bn.options.filter((option, index) => content.optionImageStatus?.[q.id]?.bn?.[index] || hasOptionImage(option)).length || 0), 0) || 0;
  const change = (patch: Partial<Question>) => {
    setZipPreview(null);
    setQuestions(previous => previous.map(q => q.id === selectedId ? { ...q, ...patch } : q));
    setNotice("");
  };

  function downloadManifest() {
    const first = questions[0];
    if (!first) return;
    const manifest = { version: 1, examSlug: paper.examSlug, paperId: paper.id, images: [
      { questionId: first.id, target: "question", file: "images/question.png" },
      ...(first.options.length ? [{ questionId: first.id, target: "option", option: "A", language: "en", file: "images/option-a.png" }] : []),
    ] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "manifest.json"; link.click(); URL.revokeObjectURL(url);
  }

  async function importZip(action: "validate" | "apply") {
    if (!zipFile || !content || dirty || locked || (action === "apply" && !zipPreview)) return;
    setUploading(true); setError(""); setNotice("");
    setZipOpen(true);
    setZipStatus({ stage: action === "validate" ? "validating" : "uploading", filename: zipFile.name,
      message: action === "validate" ? "Validating ZIP and checking image targets…" : "Uploading images to B2 and saving paper links…" });
    try {
      const body = new FormData(); body.append("zipFile", zipFile); body.append("action", action);
      body.append("expectedUpdatedAt", JSON.stringify(content.updatedAt));
      const endpoint = adminScopedUrl(`${API_BASE}/api/mocktest/admin/slots/${encodeURIComponent(paper.id)}/question-images-zip?examSlug=${encodeURIComponent(paper.examSlug)}`, mode);
      const data = await read(await requestResponse(endpoint, { method: "POST", body, signal: operations.current?.signal }, { timeoutMs: 180000 }));
      if (operations.current?.signal.aborted) return;
      if (action === "validate") {
        setZipPreview(data);
        setZipStatus({ stage: "ready", filename: zipFile.name, message: "ZIP validated. Review the targets below, then upload." });
      }
      else {
        setZipFile(null); setZipPreview(null); setLoading(true); setRevision(value => value + 1);
        setZipStatus({ stage: "success", filename: zipFile.name, images: data.images || zipPreview?.images,
          message: `${data.fileCount} image file${data.fileCount === 1 ? "" : "s"} uploaded to B2 and linked to ${data.savedQuestions} question${data.savedQuestions === 1 ? "" : "s"}.` });
      }
    } catch (reason) {
      if (!operations.current?.signal.aborted) {
        setZipPreview(null);
        setZipStatus({ stage: "error", filename: zipFile.name, message: `${reason instanceof Error ? reason.message : "Could not import ZIP."}${action === "apply" ? " Reload the paper to check its state before retrying." : ""}` });
      }
    } finally { setUploading(false); }
  }
  const changeText = (patch: Partial<Translation>) => {
    if (!selected) return;
    if (language === "bn" && selected.translations) change({ translations: { bn: { ...selected.translations.bn, ...patch } } });
    else change(patch);
  };

  async function uploadImage(file: File, questionId: string) {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { setError("Choose a PNG, JPEG, WebP or GIF image."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Choose an image smaller than 10 MB."); return; }
    setUploading(true); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("image", file);
      const data = await read(await requestResponse(adminScopedUrl(`${API_BASE}/api/upload/question-image`, mode), { method: "POST", body, signal: operations.current?.signal }));
      if (operations.current?.signal.aborted) return;
      setQuestions(previous => previous.map(q => q.id === questionId ? { ...q, questionImage: data.url } : q));
      setNotice("Image attached. Save changes to update the paper.");
    } catch (reason) { if (!operations.current?.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not upload image."); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!content || !dirty || locked) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const edits = changed.map(q => {
        let correctAnswer = q.correctAnswer;
        if (numericalDrafts[q.id] !== undefined) {
          try { correctAnswer = JSON.parse(numericalDrafts[q.id]); }
          catch { throw new Error(`Question ${q.id}: enter a numerical answer or a JSON range such as {"min":1,"max":2}.`); }
        }
        return { id: q.id, question: q.question, options: q.options, correctAnswer, solution: q.solution,
          questionImage: q.questionImage, ...(q.translations ? { translations: q.translations } : {}) };
      });
      const data = await read(await requestResponse(base, { method: "PATCH", headers: { "Content-Type": "application/json" },
        signal: operations.current?.signal, body: JSON.stringify({ examSlug: paper.examSlug, expectedUpdatedAt: content.updatedAt, edits }) }));
      if (operations.current?.signal.aborted) return;
      const saved = questions.map(q => ({ ...q, correctAnswer: edits.find(edit => edit.id === q.id)?.correctAnswer ?? q.correctAnswer }));
      setQuestions(saved); setContent({ ...content, questions: saved, updatedAt: data.updatedAt }); setNumericalDrafts({});
      setNotice(`${edits.length} question${edits.length === 1 ? "" : "s"} saved.`);
    } catch (reason) { if (!operations.current?.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not save questions."); }
    finally { setSaving(false); }
  }

  function reload() {
    if (dirty && !window.confirm("Discard unsaved question changes and reload this paper?")) return;
    setZipPreview(null); setError(""); setNotice(""); setLoading(true); setContent(null); setQuestions([]); setNumericalDrafts({}); setRevision(value => value + 1);
  }

  const text = language === "bn" && selected?.translations ? selected.translations.bn : selected;
  const position = questions.findIndex(q => q.id === selectedId);
  return <section className={styles.root} aria-label="Paper questions editor">
    <div className={styles.heading}><div><h2>{paper.title}</h2><p>{loading ? "Loading questions…" : `${questions.length} questions · ${changed.length} unsaved`}</p></div>
      <div className={styles.actions}><button data-ui-button="secondary" disabled={locked} onClick={() => { if (!dirty || window.confirm("Discard unsaved question changes?")) onClose(); }}>Back to papers</button>
        <button data-ui-button="secondary" disabled={locked || loading} onClick={reload}>Reload paper</button>
        <button data-ui-button="primary" className={styles.primary} disabled={!dirty || locked || loading} onClick={save}>{saving ? "Saving…" : "Save question changes"}</button></div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {content && <details className={styles.imagePanel} open={zipOpen} onToggle={event => setZipOpen(event.currentTarget.open)}>
        <summary>Bulk upload question &amp; option images (.zip)</summary>
        <p className={styles.linkedStatus}>Already linked in this paper: {linkedQuestions} question image{linkedQuestions === 1 ? "" : "s"} · {linkedOptions} option image{linkedOptions === 1 ? "" : "s"}.</p>
        <p>Validate your ZIP, review the targets, then upload to B2 and save links to this paper.</p>
        <p>Question images replace the shared illustration. Option images replace the selected option’s entire content in the chosen language.</p>
        <div className={styles.actions}>
          <a href="/docs/paper-image-zip-policy.md" download>Download ZIP format &amp; policy (.md)</a>
          <button data-ui-button="secondary" type="button" disabled={locked} onClick={downloadManifest}>Download manifest template</button>
        </div>
        <p>Paper ID: <code>{paper.id}</code> · Exam: <code>{paper.examSlug}</code>. Use exact question IDs shown below.</p>
        <label>Paper image ZIP<input aria-label="Paper image ZIP" type="file" accept=".zip,application/zip" disabled={dirty || locked || loading} onChange={event => {
          const file = event.target.files?.[0]; setZipPreview(null); setZipFile(null); setError("");
          setZipOpen(true);
          if (file && (!/\.zip$/i.test(file.name) || file.size > 20 * 1024 * 1024)) setZipStatus({ stage: "error", filename: file.name, message: "Choose a .zip file no larger than 20 MiB. Split larger uploads." });
          else { setZipFile(file || null); setZipStatus({ stage: file ? "selected" : "idle", filename: file?.name, message: file ? "ZIP selected. Validate it before uploading." : "Choose a ZIP to begin." }); }
          event.target.value = "";
        }} /></label>
        {dirty && <p>Save or reload your question changes before importing a ZIP.</p>}
        <div className={styles.actions}>
          <button data-ui-button="secondary" type="button" disabled={!zipFile || dirty || locked || loading} onClick={() => void importZip("validate")}>{zipStatus.stage === "validating" ? "Validating ZIP…" : "Validate ZIP"}</button>
          <button data-ui-button="primary" className={styles.primary} type="button" disabled={!zipPreview || dirty || locked || loading} onClick={() => void importZip("apply")}>{zipStatus.stage === "uploading" ? "Uploading & linking…" : "Upload & link images"}</button>
        </div>
        <div className={styles.zipStatus} data-stage={zipStatus.stage} role={zipStatus.stage === "error" ? "alert" : "status"} aria-live={zipStatus.stage === "error" ? "assertive" : "polite"} aria-atomic="true" aria-busy={zipBusy}>
          <div className={styles.zipStatusHeading}>{zipBusy && <span className={styles.zipSpinner} aria-hidden="true" />}<strong>{{ idle: "Ready to upload", selected: "ZIP selected", validating: "Validating ZIP", ready: "Ready to upload", uploading: "Upload in progress", success: "Upload successful", error: "ZIP upload needs attention" }[zipStatus.stage]}</strong></div>
          {zipStatus.filename && <p className={styles.zipFilename}>{zipStatus.filename}</p>}
          <p>{zipStatus.message}</p>
          {zipBusy && <><progress aria-label={zipStatus.stage === "validating" ? "ZIP validation in progress" : "Image upload in progress"} /><p>Keep this page open until processing finishes.</p></>}
          {zipStatus.stage === "error" && zipFile && <p>Correct the ZIP and choose it again, or validate again to retry.</p>}
          {zipStatus.stage === "success" && <p>Saved to this paper. You can upload another ZIP.</p>}
        </div>
        {(zipPreview || zipStatus.stage === "success") && <div><p>{zipPreview ? `Validated: ${zipPreview.fileCount} file${zipPreview.fileCount === 1 ? "" : "s"} · ${zipPreview.questionCount} question${zipPreview.questionCount === 1 ? "" : "s"}. Review before uploading:` : "Completed targets:"}</p>
          <ul>{(zipPreview?.images || zipStatus.images || []).map((image, index) => {
            const existing = content.questions.find(q => q.id === image.questionId);
            const optionIndex = "ABCDEFGH".indexOf(image.option || "");
            const existingImage = image.target === "question" ? Boolean(existing?.questionImage) : content.optionImageStatus?.[image.questionId]?.[image.language === "bn" ? "bn" : "en"]?.[optionIndex] || hasOptionImage((image.language === "bn" ? existing?.translations?.bn.options : existing?.options)?.[optionIndex] || "");
            return <li key={index}><code>{image.questionId}</code> · {image.target}{image.option ? ` ${image.option} (${image.language})` : " (all languages)"} ← {image.file}<span className={styles.targetStatus}>{zipStatus.stage === "success" ? "Uploaded & linked" : existingImage ? "Already linked · will replace image" : image.replaces ? "New image · replaces existing content" : "New image · ready to upload"}</span></li>;
          })}</ul>
        </div>}
      </details>}
    {loading ? <p className={styles.empty} role="status">Loading all paper questions…</p> : content && <>
      <div className={styles.filters}>
        <label>Find question<input aria-label="Find question" type="search" placeholder="Search text or question ID" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <label>Section<select aria-label="Section" value={section} onChange={e => setSection(e.target.value)}><option value="">All sections</option>{sections.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
      <nav className={styles.questionNumbers} aria-label="Paper questions">
        {filtered.map(q => <button data-ui-button="state" key={q.id} disabled={locked} aria-label={`Question ${questions.indexOf(q) + 1}`} aria-current={q.id === selectedId ? "true" : undefined}
          onClick={() => { setSelectedId(q.id); setLanguage("en"); }}>{questions.indexOf(q) + 1}{changed.some(edit => edit.id === q.id) ? " •" : ""}</button>)}
        {!filtered.length && <p>No questions match this search.</p>}
      </nav>
      {selected && text && <div className={styles.editor}>
        <div className={styles.heading}><div><h3>Question {position + 1} of {questions.length}</h3><p>{selected.id} · {selected.sectionKey || "General"} · {selected.questionType}</p></div>
          {selected.translations && <label>Language<select aria-label="Language" disabled={locked} value={language} onChange={e => setLanguage(e.target.value as "en" | "bn")}><option value="en">English</option><option value="bn">বাংলা</option></select></label>}
        </div>
        <fieldset disabled={locked}>
          <label>Question text<textarea aria-label="Question text" value={text.question} onChange={e => changeText({ question: e.target.value })} rows={5} /></label>
          {selected.questionType !== "NAT" && <div className={styles.optionFields}>{text.options.map((option, index) => <label key={index}>Option {"ABCDEFGH"[index]}<textarea aria-label={`Option ${"ABCDEFGH"[index]}`} rows={2} value={option} onChange={e => changeText({ options: text.options.map((value, i) => i === index ? e.target.value : value) })} /></label>)}</div>}
          {selected.questionType === "NAT" ? <label>Correct numerical answer<input aria-label="Correct numerical answer" value={numericalDrafts[selected.id] ?? (typeof selected.correctAnswer === "object" ? JSON.stringify(selected.correctAnswer) : String(selected.correctAnswer))} onChange={e => { setNumericalDrafts(previous => ({ ...previous, [selected.id]: e.target.value })); setNotice(""); }} /><small>Enter a number or a range: {`{"min":1,"max":2}`}</small></label>
            : selected.questionType === "MSQ" ? <div><p>Correct answers</p><div className={styles.actions}>{selected.options.map((_, index) => <label className={styles.checkbox} key={index}><input aria-label={`Correct option ${"ABCDEFGH"[index]}`} type="checkbox" checked={Array.isArray(selected.correctAnswer) && selected.correctAnswer.includes(index)} onChange={e => { const answers = Array.isArray(selected.correctAnswer) ? selected.correctAnswer : []; change({ correctAnswer: e.target.checked ? [...answers, index] : answers.filter(value => value !== index) }); }} />{"ABCDEFGH"[index]}</label>)}</div></div>
            : <label>Correct answer<select aria-label="Correct answer" value={String(selected.correctAnswer)} onChange={e => change({ correctAnswer: Number(e.target.value) })}>{selected.options.map((_, index) => <option key={index} value={index}>{"ABCDEFGH"[index]}</option>)}</select></label>}
          <label>Solution<textarea aria-label="Solution" rows={4} value={text.solution} onChange={e => changeText({ solution: e.target.value })} /></label>
          <div className={styles.imagePanel}>
            <h3>Question image</h3><p>Attach an illustration or a scan of the question. The image is shared across languages.</p>
            <label>Image URL<input aria-label="Question image URL" value={selected.questionImage || ""} onChange={e => change({ questionImage: e.target.value || null })} placeholder="https://…" /></label>
            <label>Upload question image<input aria-label="Upload question image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, selected.id); e.target.value = ""; }} /></label>
            {uploading && !zipBusy && <p role="status">Uploading image…</p>}
            {selected.questionImage && /^(https?:\/\/|\/(?!\/))/i.test(selected.questionImage) && <QuestionImage src={selected.questionImage} alt={`Question ${position + 1} image preview`} />}
            {selected.questionImage && <button data-ui-button="secondary" type="button" onClick={() => change({ questionImage: null })}>Remove image</button>}
          </div>
        </fieldset>
        <div className={styles.toolbar}><button data-ui-button="secondary" disabled={locked || position <= 0} onClick={() => { setSelectedId(questions[position - 1].id); setLanguage("en"); }}>Previous question</button>
          <button data-ui-button="secondary" disabled={locked || position >= questions.length - 1} onClick={() => { setSelectedId(questions[position + 1].id); setLanguage("en"); }}>Next question</button></div>
        <button data-ui-button="primary" className={styles.primary} disabled={!dirty || locked} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
      </div>}
    </>}
  </section>;
}
