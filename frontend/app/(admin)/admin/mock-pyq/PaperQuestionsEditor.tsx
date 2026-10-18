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
type PaperContent = { questions: Question[]; updatedAt: string | null };
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
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const selected = questions.find(q => q.id === selectedId);
  const filtered = questions.filter(q => (!section || q.sectionKey === section) && `${q.id} ${q.question} ${q.translations?.bn.question || ""}`.toLowerCase().includes(search.toLowerCase()));
  const sections = [...new Set(questions.flatMap(q => q.sectionKey ? [q.sectionKey] : []))];
  const locked = saving || uploading;
  const change = (patch: Partial<Question>) => {
    setQuestions(previous => previous.map(q => q.id === selectedId ? { ...q, ...patch } : q));
    setNotice("");
  };
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
      setQuestions(saved); setContent({ questions: saved, updatedAt: data.updatedAt }); setNumericalDrafts({});
      setNotice(`${edits.length} question${edits.length === 1 ? "" : "s"} saved.`);
    } catch (reason) { if (!operations.current?.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not save questions."); }
    finally { setSaving(false); }
  }

  function reload() {
    if (dirty && !window.confirm("Discard unsaved question changes and reload this paper?")) return;
    setError(""); setNotice(""); setLoading(true); setContent(null); setQuestions([]); setNumericalDrafts({}); setRevision(value => value + 1);
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
            {uploading && <p role="status">Uploading image…</p>}
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
