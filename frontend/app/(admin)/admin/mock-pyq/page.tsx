"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useExamMode } from "@/context/ExamModeContext";
import { API_BASE } from "@/lib/api-base";
import { adminScopedUrl } from "@/lib/admin-exam-mode";
import { invalidateMockCatalog } from "@/lib/mock-catalog-revision";
import { requestResponse } from "@/shared/api/request";
import styles from "./papers.module.css";
import PaperQuestionsEditor from "./PaperQuestionsEditor";
import { comparePaperDateAndShift, paperDateLabel } from "./paper-order";

type Paper = {
  id: string; examSlug: string; title: string; tier?: string; type?: string;
  year?: number | null; shift?: string | number | null; order?: number; isFree?: boolean;
  questionCount?: number; examDate?: string | null;
};
const kind = (paper: Paper) => paper.type || (paper.id.includes("pyq") ? "pyq" : "mock");
const examName = (slug: string) => slug.replaceAll("-", " ").toUpperCase();

async function readResponse(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not complete the request. Please try again.");
  return data;
}

export default function MockPyqPage() {
  const { mode } = useExamMode();
  // Reset filters, drafts and requests together when the exam mode changes.
  return <PaperManager key={mode} mode={mode} />;
}

function PaperManager({ mode }: { mode: "ssc" | "iit-jam" }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [exam, setExam] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const [access, setAccess] = useState("");
  const [editing, setEditing] = useState<Paper | null>(null);
  const [questionPaper, setQuestionPaper] = useState<Paper | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    requestResponse(adminScopedUrl(`${API_BASE}/api/mocktest/admin/all-slots?exam=all`, mode), { signal: controller.signal })
      .then(readResponse)
      .then(data => {
        if (!controller.signal.aborted) setPapers((data.slots || []).filter((paper: Paper) => paper.examSlug.startsWith("iit-jam") === (mode === "iit-jam")));
      })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load papers."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mode, revision]);

  const filtered = papers.filter(paper =>
    (!exam || paper.examSlug === exam) && (!type || kind(paper) === type) &&
    (!year || String(paper.year) === year) && (!access || Boolean(paper.isFree) === (access === "free")) &&
    `${paper.title} ${paper.id} ${paper.examSlug} ${paper.tier || ""} ${paper.shift || ""}`.toLowerCase().includes(search.trim().toLowerCase())
  ).sort(comparePaperDateAndShift);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const exams = [...new Set(papers.map(paper => paper.examSlug))].sort();
  const years = [...new Set(papers.flatMap(paper => paper.year ? [paper.year] : []))].sort((a, b) => b - a);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    if (!editing.title.trim()) { setError("Enter a paper title."); return; }
    setSaving(true); setError(""); setMessage("");
    try {
      const updates = { examSlug: editing.examSlug, title: editing.title.trim(), type: kind(editing), isPyq: kind(editing) === "pyq",
        tier: editing.tier || null, year: editing.year || null,
        shift: typeof editing.shift === "string" ? editing.shift.trim() || null : editing.shift ?? null,
        order: editing.order ?? 1, isFree: Boolean(editing.isFree) };
      await readResponse(await requestResponse(adminScopedUrl(`${API_BASE}/api/mocktest/admin/slots/${encodeURIComponent(editing.id)}`, mode), {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
      }));
      invalidateMockCatalog(editing.examSlug);
      setPapers(previous => previous.map(paper => paper.id === editing.id && paper.examSlug === editing.examSlug ? { ...paper, ...updates, tier: updates.tier || undefined } : paper));
      setEditing(null); setMessage("Paper details saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save paper."); }
    finally { setSaving(false); }
  }

  if (questionPaper) return <PaperQuestionsEditor key={`${questionPaper.examSlug}:${questionPaper.id}`} paper={questionPaper} mode={mode} onClose={() => { setQuestionPaper(null); setLoading(true); setRevision(value => value + 1); }} />;

  return <section className={styles.root}>
    <div className={styles.heading}>
      <div><h2>Mock &amp; Pyq</h2><p>Find and edit your {mode === "iit-jam" ? "IIT JAM" : "SSC"} papers.</p></div>
      <Link className={styles.primary} href="/admin/upload/mock-tests">Upload paper</Link>
    </div>
    <div className={styles.filters}>
      <label>Search<input aria-label="Search" type="search" placeholder="Title, ID, tier or shift" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
      <label>Exam<select value={exam} onChange={e => { setExam(e.target.value); setPage(1); }}><option value="">All exams</option>{exams.map(value => <option key={value} value={value}>{examName(value)}</option>)}</select></label>
      <label>Paper type<select value={type} onChange={e => { setType(e.target.value); setPage(1); }}><option value="">Mocks &amp; PYQs</option><option value="mock">Mock tests</option><option value="pyq">PYQs</option></select></label>
      <label>Year<select value={year} onChange={e => { setYear(e.target.value); setPage(1); }}><option value="">All years</option>{years.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Access<select value={access} onChange={e => { setAccess(e.target.value); setPage(1); }}><option value="">All access</option><option value="free">Free</option><option value="pro">Pro</option></select></label>
    </div>
    <div className={styles.toolbar}>
      <p aria-live="polite">{loading ? "Loading papers…" : `${filtered.length} of ${papers.length} papers`}</p>
      <div className={styles.actions}><button data-ui-button="secondary" onClick={() => { setSearch(""); setExam(""); setType(""); setYear(""); setAccess(""); setPage(1); }}>Clear filters</button>
      <button data-ui-button="secondary" disabled={loading || saving} onClick={() => { setLoading(true); setError(""); setRevision(value => value + 1); }}>Refresh</button></div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {editing && <form className={styles.editor} onSubmit={save} aria-label="Edit paper">
      <h3>Edit paper</h3><p>{editing.id} · {examName(editing.examSlug)}</p>
      <fieldset disabled={saving}>
        <div className={styles.fields}>
          <label>Title<input aria-label="Title" required value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></label>
          <label>Type<select value={kind(editing)} onChange={e => setEditing({ ...editing, type: e.target.value })}><option value="mock">Mock test</option><option value="pyq">PYQ</option></select></label>
          <label>Stage / tier<input aria-label="Stage / tier" value={editing.tier || ""} onChange={e => setEditing({ ...editing, tier: e.target.value })} /></label>
          <label>Exam year<input aria-label="Exam year" type="number" min="1900" max="2100" value={editing.year ?? ""} onChange={e => setEditing({ ...editing, year: e.target.value ? Number(e.target.value) : null })} /></label>
          <label>Shift<input aria-label="Shift" value={editing.shift ?? ""} onChange={e => setEditing({ ...editing, shift: e.target.value })} /></label>
          <label>Display order<input aria-label="Display order" type="number" required min="1" value={editing.order ?? 1} onChange={e => setEditing({ ...editing, order: e.target.valueAsNumber })} /></label>
        </div>
        <label className={styles.checkbox}><input aria-label="Free access" type="checkbox" checked={Boolean(editing.isFree)} onChange={e => setEditing({ ...editing, isFree: e.target.checked })} />Free access</label>
        <p>Use Edit questions to change individual questions and attach images.</p>
        <div className={styles.actions}><button data-ui-button="primary" className={styles.primary} type="submit">{saving ? "Saving…" : "Save changes"}</button><button data-ui-button="secondary" type="button" onClick={() => setEditing(null)}>Cancel</button></div>
      </fieldset>
    </form>}
    <div className={styles.tableWrap} aria-busy={loading}>
      {loading ? <p className={styles.empty} role="status">Loading papers…</p> : !visible.length ? <p className={styles.empty}>{papers.length ? "No papers match these filters." : "No papers available. Upload a paper to get started."}</p> :
        <table><thead><tr>{["No.", "Paper", "Exam / tier", "Type", "Date / shift", "Questions", "Access", "Actions"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{visible.map((paper, index) => <tr key={`${paper.examSlug}:${paper.id}`}>
            <td className={styles.paperNumber}>{(currentPage - 1) * 25 + index + 1}</td>
            <td><strong>{paper.title}</strong><small>{paper.id}</small></td>
            <td>{examName(paper.examSlug)}<small>{paper.tier || "—"}</small></td>
            <td>{kind(paper) === "pyq" ? "PYQ" : "Mock"}</td><td>{paperDateLabel(paper)}<small>{paper.shift == null ? '—' : /^\d+$/.test(String(paper.shift)) ? `Shift ${paper.shift}` : paper.shift}</small></td>
            <td>{paper.questionCount || "—"}</td><td><span className={styles.badge}>{paper.isFree ? "Free" : "Pro"}</span></td>
            <td><div className={styles.actions}><button data-ui-button="secondary" disabled={saving} aria-label={`Edit ${paper.title}`} onClick={() => { setEditing({ ...paper }); setMessage(""); setError(""); }}>Edit</button>
              <button data-ui-button="secondary" disabled={saving} aria-label={`Edit questions in ${paper.title}`} onClick={() => { setEditing(null); setQuestionPaper(paper); }}>Edit questions</button></div></td>
          </tr>)}</tbody></table>}
    </div>
    {filtered.length > 25 && <div className={styles.toolbar}><button data-ui-button="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button data-ui-button="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
  </section>;
}
