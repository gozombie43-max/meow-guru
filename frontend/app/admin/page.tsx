"use client";
import { useState, useEffect, useCallback } from "react";
import RichContent from "@/components/RichContent";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Question = {
  id: string;
  topic: string;
  subject: string;
  chapter: string;
  subtopic: string;
  difficulty: string;
  exam: string;
  question: string;
  options: string[];
  correctAnswer: string;
  correctLetter: string;
  concept: string;
  source: string;
  solution: string;
};

const EMPTY_Q: Omit<Question, "id"> = {
  topic: "", subject: "", chapter: "", subtopic: "",
  difficulty: "medium", exam: "", question: "",
  options: ["", "", "", ""], correctAnswer: "",
  correctLetter: "", concept: "", source: "", solution: "",
};

const DIFFICULTIES = ["easy", "medium", "hard"];
const LETTERS = ["a", "b", "c", "d"];
const SUBJECTS = ["mathematics", "reasoning", "english", "general awareness"];

export default function AdminPanel() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filtered, setFiltered] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterExam, setFilterExam] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Modal
  const [editing, setEditing] = useState<Question | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Omit<Question, "id">>(EMPTY_Q);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const topics = [...new Set(questions.map((q) => q.topic).filter(Boolean))].sort();
  const exams = [...new Set(questions.map((q) => q.exam).filter(Boolean))].sort();

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterTopic) params.set("topic", filterTopic);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterExam) params.set("exam", filterExam);
      const res = await fetch(`${API}/api/questions?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setQuestions(Array.isArray(data) ? data : data.questions || []);
      setSelected(new Set());
      setPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [filterTopic, filterSubject, filterDifficulty, filterExam]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      questions.filter(
        (x) =>
          !q ||
          x.question?.toLowerCase().includes(q) ||
          x.id?.toLowerCase().includes(q) ||
          x.chapter?.toLowerCase().includes(q)
      )
    );
    setPage(1);
  }, [search, questions]);

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 3000);
  };

  // ── Checkbox helpers ──────────────────────────────────
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginatedIds = paginated.map((q) => q.id);
  const allPageSelected = paginatedIds.length > 0 && paginatedIds.every((id) => selected.has(id));

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginatedIds.forEach((id) => next.delete(id));
      } else {
        paginatedIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map((q) => q.id)));
  };

  const clearSelection = () => setSelected(new Set());

  // ── Bulk delete ───────────────────────────────────────
  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    for (const id of selected) {
      try {
        const res = await fetch(`${API}/api/questions/${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkDeleting(false);
    setBulkDeleteConfirm(false);
    setSelected(new Set());
    showMsg(failed > 0 ? `Deleted ${deleted}, failed ${failed}` : `Deleted ${deleted} questions ✓`);
    fetchQuestions();
  };

  // ── Single CRUD ───────────────────────────────────────
  const openEdit = (q: Question) => { setEditing(q); setIsNew(false); setFormData({ ...q }); };
  const openNew = () => { setEditing({ id: "" } as Question); setIsNew(true); setFormData({ ...EMPTY_Q }); };
  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async () => {
    try {
      if (isNew) {
        const res = await fetch(`${API}/api/questions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        showMsg("Question created ✓");
      } else {
        const res = await fetch(`${API}/api/questions/${editing!.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        showMsg("Question updated ✓");
      }
      closeModal();
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Save failed", true);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/questions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      showMsg("Question deleted ✓");
      setDeleteConfirm(null);
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Delete failed", true);
    }
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const diffColor = (d: string) =>
    d === "easy" ? "#16a34a" : d === "hard" ? "#dc2626" : "#d97706";

  return (
    <div style={{ fontFamily: "var(--font-sans, system-ui)", padding: "1.5rem", maxWidth: 1280, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Question Bank Admin</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            {filtered.length} of {questions.length} questions
            {selected.size > 0 && <span style={{ marginLeft: 8, color: "#6d28d9", fontWeight: 500 }}>· {selected.size} selected</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <>
              <button onClick={clearSelection} style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                Clear
              </button>
              <button onClick={() => setBulkDeleteConfirm(true)} style={{ padding: "8px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                Delete {selected.size} selected
              </button>
            </>
          )}
          <button onClick={openNew} style={{ padding: "8px 16px", background: "#6d28d9", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
            + Add Question
          </button>
        </div>
      </div>

      {/* Toast */}
      {(error || success) && (
        <div style={{ padding: "10px 16px", borderRadius: 8, marginBottom: "1rem", background: error ? "#fef2f2" : "#f0fdf4", color: error ? "#dc2626" : "#16a34a", border: `1px solid ${error ? "#fecaca" : "#bbf7d0"}`, fontSize: 14 }}>
          {error || success}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: "1rem" }}>
        <input placeholder="Search question, chapter, ID..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }} />
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All subjects</option>
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterTopic} onChange={(e) => setFilterTopic(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterExam} onChange={(e) => setFilterExam(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All exams</option>
          {exams.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Select all banner */}
      {selected.size > 0 && (
        <div style={{ padding: "8px 14px", background: "#ede9fe", borderRadius: 8, marginBottom: 10, fontSize: 13, color: "#5b21b6", display: "flex", alignItems: "center", gap: 12 }}>
          <span>{selected.size} question{selected.size > 1 ? "s" : ""} selected</span>
          {selected.size < filtered.length && (
            <button onClick={selectAll} style={{ background: "none", border: "none", cursor: "pointer", color: "#6d28d9", fontWeight: 500, fontSize: 13, padding: 0 }}>
              Select all {filtered.length}
            </button>
          )}
          <button onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "#6d28d9", fontSize: 13, padding: 0, marginLeft: "auto" }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--color-background-secondary)" }}>
              <th style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", width: 40 }}>
                <input type="checkbox" checked={allPageSelected} onChange={togglePage}
                  style={{ cursor: "pointer", width: 15, height: 15 }} title="Select all on this page" />
              </th>
              {["ID", "Topic", "Chapter", "Difficulty", "Exam", "Question", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>Loading...</td></tr>
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--color-text-secondary)" }}>No questions found</td></tr>
            ) : paginated.map((q, i) => (
              <tr key={q.id} style={{
                borderBottom: "0.5px solid var(--color-border-tertiary)",
                background: selected.has(q.id) ? "#ede9fe" : i % 2 === 0 ? "var(--color-background-primary)" : "var(--color-background-secondary)"
              }}>
                <td style={{ padding: "10px 14px" }}>
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)}
                    style={{ cursor: "pointer", width: 15, height: 15 }} />
                </td>
                <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{q.id?.slice(0, 16)}...</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{q.topic}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.chapter}</td>
                <td style={{ padding: "10px 14px" }}>
                  <span style={{ color: diffColor(q.difficulty), fontWeight: 500, fontSize: 12 }}>{q.difficulty}</span>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{q.exam}</td>
                <td style={{ padding: "10px 14px", maxWidth: 320 }}>
                  <div style={{ maxHeight: 64, overflow: "hidden" }}>
                    <RichContent text={q.question || ""} />
                  </div>
                </td>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                  <button onClick={() => openEdit(q)} style={{ marginRight: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>Edit</button>
                  <button onClick={() => setDeleteConfirm(q.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "0.5px solid #fecaca", background: "transparent", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "1rem", justifyContent: "center" }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>»</button>
        </div>
      )}

      {/* Edit / Create Modal */}
      {editing && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", borderRadius: 16, padding: "1.5rem", width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>{isNew ? "Add Question" : "Edit Question"}</h2>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--color-text-secondary)" }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {(["topic", "subject", "chapter", "subtopic", "exam", "concept", "source"] as const).map((field) => (
                <div key={field}>
                  <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4, textTransform: "capitalize" }}>{field}</label>
                  <input value={(formData as Record<string, unknown>)[field] as string || ""} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                    style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", boxSizing: "border-box" }} />
                </div>
              ))}

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Question</label>
                <textarea value={formData.question} onChange={(e) => setFormData({ ...formData, question: e.target.value })} rows={3}
                  style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", resize: "vertical", boxSizing: "border-box" }} />
              </div>

              <div style={{ gridColumn: "1 / -1", border: "0.5px dashed var(--color-border-secondary, #e5e7eb)", borderRadius: 10, padding: "10px 12px", background: "var(--color-background-secondary, #f8fafc)" }}>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>Preview</div>
                <RichContent text={formData.question || ""} />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Options</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)", width: 16 }}>{LETTERS[i]})</span>
                      <input value={formData.options[i] || ""} onChange={(e) => { const opts = [...formData.options]; opts[i] = e.target.value; setFormData({ ...formData, options: opts }); }}
                        style={{ flex: 1, padding: "6px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)" }} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Correct Answer</label>
                <input value={formData.correctAnswer} onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                  style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Correct Letter</label>
                <select value={formData.correctLetter} onChange={(e) => setFormData({ ...formData, correctLetter: e.target.value })}
                  style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)" }}>
                  <option value="">Select</option>
                  {LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Difficulty</label>
                <select value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                  style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)" }}>
                  {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>Solution / Explanation</label>
                <textarea value={formData.solution || ""} onChange={(e) => setFormData({ ...formData, solution: e.target.value })} rows={4}
                  placeholder="Step-by-step solution..."
                  style={{ width: "100%", padding: "7px 10px", border: "0.5px solid var(--color-border-secondary, #e5e7eb)", borderRadius: 7, fontSize: 13, background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "1.25rem", justifyContent: "flex-end" }}>
              <button onClick={closeModal} style={{ padding: "8px 18px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 14 }}>Cancel</button>
              <button onClick={handleSave} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#6d28d9", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                {isNew ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", borderRadius: 16, padding: "1.5rem", width: 360, border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>Delete question?</h2>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem" }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: "7px 16px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm */}
      {bulkDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--color-background-primary, #ffffff)", color: "var(--color-text-primary, #111827)", borderRadius: 16, padding: "1.5rem", width: 400, border: "0.5px solid var(--color-border-secondary, #e5e7eb)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, margin: "0 0 8px" }}>Delete {selected.size} questions?</h2>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 1.25rem" }}>
              This will permanently delete all {selected.size} selected questions. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setBulkDeleteConfirm(false)} disabled={bulkDeleting}
                style={{ padding: "7px 16px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 13 }}>Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", cursor: bulkDeleting ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: bulkDeleting ? 0.7 : 1 }}>
                {bulkDeleting ? "Deleting..." : `Delete ${selected.size} questions`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}