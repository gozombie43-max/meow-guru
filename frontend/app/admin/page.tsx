"use client";
import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import RichContent from "@/components/RichContent";
import MassImageUpload from "../../components/admin/MassImageUpload";
import MassSolutionUpload from "@/components/admin/MassSolutionUpload";

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
  questionType?: string;
  questionImage?: string;
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

type SubjectKey = "mathematics" | "reasoning" | "english" | "general-awareness";
type TopicOption = { value: string; label: string };
type BulkStats = { total: number; ready: number; errors: number };
type BulkImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_BULK_IMAGES = 20;

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const precision = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
};

const SUBJECT_OPTIONS: { value: SubjectKey; label: string }[] = [
  { value: "mathematics", label: "Mathematics" },
  { value: "reasoning", label: "Reasoning" },
  { value: "english", label: "English" },
  { value: "general-awareness", label: "General Awareness" },
];

const QUIZ_OPTIONS = [
  "Concept Drill",
  "Formula Bank",
  "Speed Test",
  "Challenge",
  "Topic Mix",
  "Revision",
];

const TOPIC_LABEL_OVERRIDES: Record<string, string> = {
  "active-passive-voice": "Active & Passive Voice",
  "direct-indirect-narration": "Direct & Indirect Narration",
  "subject-verb-agreement": "Subject-Verb Agreement",
  "homonyms-homophones": "Homonyms & Homophones",
  "idioms-phrases": "Idioms & Phrases",
  "synonyms-antonyms": "Synonyms & Antonyms",
  "sentence-correction-improvement": "Sentence Correction / Improvement",
  "spot-the-error-error-detection": "Spot the Error / Error Detection",
  "para-sentence-completion": "Para / Sentence Completion",
  "statement-conclusion": "Statement & Conclusion",
  "statement-assumptions": "Statement & Assumptions",
  "statement-arguments": "Statement & Arguments",
  "problem-solving-critical-thinking": "Problem Solving & Critical Thinking",
  "classification-odd-one-out": "Classification (Odd One Out)",
  "logical-sequence-of-words": "Logical Sequence of Words",
  "mathematical-symbolic-operations": "Mathematical & Symbolic Operations",
  "direction-distance": "Direction & Distance",
  "cube-dice": "Cube & Dice",
  "mirror-water-image": "Mirror & Water Image",
  "paper-folding-cutting": "Paper Folding & Cutting",
  "mixture-and-alligation": "Mixture & Alligation",
  "ratio-and-proportion": "Ratio & Proportion",
  "time-and-distance": "Time & Distance",
  "time-and-work": "Time & Work",
  "profit-and-loss": "Profit & Loss",
  "statistics-probability": "Statistics & Probability",
  "number-system": "Number System",
  "general-science": "General Science",
  "current-affairs": "Current Affairs",
  "static-gk": "Static GK",
};

const toTopicLabel = (slug: string) => {
  const override = TOPIC_LABEL_OVERRIDES[slug];
  if (override) return override;
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const MATH_TOPICS = [
  "algebra",
  "geometry",
  "mensuration",
  "trigonometry",
  "number-system",
  "statistics-probability",
  "averages",
  "discount",
  "interest",
  "mixture-and-alligation",
  "partnership",
  "percentages",
  "profit-and-loss",
  "ratio-and-proportion",
  "square-roots",
  "time-and-distance",
  "time-and-work",
];

const REASONING_TOPICS = [
  "analogy",
  "blood-relations",
  "classification-odd-one-out",
  "coding-decoding",
  "cube-dice",
  "direction-distance",
  "emotional-intelligence",
  "inequalities",
  "logical-sequence-of-words",
  "mathematical-symbolic-operations",
  "matrix",
  "mirror-water-image",
  "non-verbal-figures",
  "order-ranking",
  "paper-folding-cutting",
  "problem-solving-critical-thinking",
  "puzzle-seating-arrangement",
  "series",
  "social-intelligence",
  "statement-arguments",
  "statement-assumptions",
  "statement-conclusion",
  "syllogism-inferences",
  "venn-diagram",
  "word-building",
];

const ENGLISH_TOPICS = [
  "active-passive-voice",
  "articles",
  "cloze-test",
  "conjunctions",
  "direct-indirect-narration",
  "fill-in-the-blanks",
  "homonyms-homophones",
  "idioms-phrases",
  "modifiers",
  "one-word-substitution",
  "para-jumbles",
  "para-sentence-completion",
  "parallelism",
  "prepositions",
  "pronouns",
  "reading-comprehension",
  "sentence-correction-improvement",
  "sentence-structure",
  "spelling-misspelled-words",
  "spot-the-error-error-detection",
  "subject-verb-agreement",
  "synonyms-antonyms",
  "tenses",
];

const GA_TOPICS = [
  "current-affairs",
  "economics",
  "general-science",
  "geography",
  "history",
  "polity",
  "static-gk",
];

const SUBJECT_TOPIC_OPTIONS: Record<SubjectKey, TopicOption[]> = {
  mathematics: MATH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  reasoning: REASONING_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  english: ENGLISH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  "general-awareness": GA_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
};

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

  // Mass upload
  const [muSubject, setMuSubject] = useState<SubjectKey | "">("");
  const [muTopic, setMuTopic] = useState("");
  const [muQuiz, setMuQuiz] = useState("");
  const [muFileName, setMuFileName] = useState("");
  const [muStats, setMuStats] = useState<BulkStats>({ total: 0, ready: 0, errors: 0 });
  const [muQuestions, setMuQuestions] = useState<Record<string, unknown>[]>([]);
  const [muUploading, setMuUploading] = useState(false);
  const [muApiUrl, setMuApiUrl] = useState(`${API}/api/questions/bulk`);
  const muFileRef = useRef<HTMLInputElement | null>(null);

  // Bulk image upload
  const [bulkImages, setBulkImages] = useState<BulkImageItem[]>([]);
  const [bulkImageNotice, setBulkImageNotice] = useState("");
  const [bulkImageUploading, setBulkImageUploading] = useState(false);
  const bulkImageRef = useRef<HTMLInputElement | null>(null);

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
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    title: string;
  } | null>(null);

  const topics = [...new Set(questions.map((q) => q.topic).filter(Boolean))].sort();
  const exams = [...new Set(questions.map((q) => q.exam).filter(Boolean))].sort();
  const muTopicOptions = muSubject ? SUBJECT_TOPIC_OPTIONS[muSubject as SubjectKey] : [];
  const selectedSubjectId = muSubject;
  const selectedTopicId = muTopic;
  const selectedQuizId = muQuiz;
  const selectedSubjectName = SUBJECT_OPTIONS.find((s) => s.value === muSubject)?.label || "";
  const selectedTopicName = muTopicOptions.find((t) => t.value === muTopic)?.label || "";
  const selectedQuizName = muQuiz || "";

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

  const parseBulkFile = async (file: File) => {
    const text = await file.text();
    const trimmed = text.trim();

    if (!trimmed) {
      setMuQuestions([]);
      setMuStats({ total: 0, ready: 0, errors: 1 });
      showMsg("Bulk file is empty", true);
      return;
    }

    let total = 0;
    let errors = 0;
    let items: unknown[] = [];

    if (trimmed.startsWith("[")) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        setMuQuestions([]);
        setMuStats({ total: 0, ready: 0, errors: 1 });
        showMsg("Bulk file JSON is invalid", true);
        return;
      }

      if (!Array.isArray(parsed)) {
        setMuQuestions([]);
        setMuStats({ total: 0, ready: 0, errors: 1 });
        showMsg("Bulk file must be a JSON array or NDJSON", true);
        return;
      }
      total = parsed.length;
      items = parsed;
    } else {
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      total = lines.length;
      for (const line of lines) {
        try {
          items.push(JSON.parse(line));
        } catch {
          errors += 1;
        }
      }
    }

    const normalized: Record<string, unknown>[] = [];
    for (const item of items) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        normalized.push(item as Record<string, unknown>);
      } else {
        errors += 1;
      }
    }

    setMuQuestions(normalized);
    setMuStats({ total, ready: normalized.length, errors });
    if (normalized.length === 0) {
      showMsg("No valid objects found in bulk file", true);
    }
  };

  const handleMuFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMuFileName(file.name);
    await parseBulkFile(file);
  };

  const handleMuClear = () => {
    setMuFileName("");
    setMuQuestions([]);
    setMuStats({ total: 0, ready: 0, errors: 0 });
    if (muFileRef.current) muFileRef.current.value = "";
  };

  const handleMuUpload = async () => {
    if (!muSubject || !muTopic || !muQuiz) {
      showMsg("Select subject, topic, and quiz before uploading", true);
      return;
    }
    if (!muQuestions.length) {
      showMsg("No questions loaded for upload", true);
      return;
    }

    setMuUploading(true);
    try {
      const payload = muQuestions.map((q) => ({
        ...q,
        quizSubject: muSubject,
        quizTopic: muTopic,
        quizName: muQuiz,
      }));

      const res = await fetch(muApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = `Server error ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }

      const data = await res.json().catch(() => ({}));
      const inserted = Number.isFinite(data?.inserted) ? data.inserted : payload.length;
      showMsg(`Uploaded ${inserted} questions`, false);
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Bulk upload failed", true);
    } finally {
      setMuUploading(false);
    }
  };

  const handleBulkImageFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const available = Math.max(0, MAX_BULK_IMAGES - bulkImages.length);
    const accepted = files.slice(0, available);
    const rejected = files.length - accepted.length;

    if (rejected > 0) {
      setBulkImageNotice(
        `Max ${MAX_BULK_IMAGES} images allowed. ${rejected} file${rejected === 1 ? "" : "s"} ignored.`
      );
    } else {
      setBulkImageNotice("");
    }

    const newItems: BulkImageItem[] = accepted.map((file) => ({
      id: `bulk-${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setBulkImages((prev) => [...prev, ...newItems]);
    if (bulkImageRef.current) bulkImageRef.current.value = "";
  };

  const removeBulkImage = (id: string) => {
    setBulkImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearBulkImages = () => {
    bulkImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setBulkImages([]);
    setBulkImageNotice("");
    if (bulkImageRef.current) bulkImageRef.current.value = "";
  };

  const handleBulkImageUpload = async () => {
    if (!bulkImages.length) {
      setBulkImageNotice("Select images before uploading.");
      return;
    }

    setBulkImageUploading(true);
    setBulkImageNotice("");
    try {
      const formData = new FormData();
      bulkImages.forEach((item) => formData.append("images", item.file));

      const res = await fetch(`${API}/api/upload/bulk-image`, {
        method: "POST",
        headers: { "x-admin-secret": "quizguru_admin_987654" },
        body: formData,
      });

      if (!res.ok) {
        let message = `Server error ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch { /* ignore */ }
        throw new Error(message);
      }

      const data = await res.json().catch(() => ({}));
      const count = Number.isFinite(data?.count) ? data.count : bulkImages.length;
      showMsg(`Uploaded ${count} image${count === 1 ? "" : "s"} ✓`, false);
      clearBulkImages();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Bulk image upload failed", true);
    } finally {
      setBulkImageUploading(false);
    }
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
        const res = await fetch(`${API}/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
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
      const res = await fetch(`${API}/api/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
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
          <a
            href="/admin/upload-image"
            style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Upload Image Question
          </a>
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

      {/* ── Mass Upload ── */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Mass Upload</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Upload NDJSON/JSONL or a JSON array. Select subject, topic, and quiz.
            </p>
          </div>
          <button onClick={handleMuClear} style={{ padding: "6px 12px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)" }}>
            Clear
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
          <select
            value={muSubject}
            onChange={(e) => {
              const next = e.target.value as SubjectKey | "";
              setMuSubject(next);
              setMuTopic("");
              setMuQuiz("");
            }}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select subject</option>
            {SUBJECT_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={muTopic}
            onChange={(e) => {
              setMuTopic(e.target.value);
              setMuQuiz("");
            }}
            disabled={!muSubject}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select topic</option>
            {muTopicOptions.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select
            value={muQuiz}
            onChange={(e) => setMuQuiz(e.target.value)}
            disabled={!muTopic}
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          >
            <option value="">Select quiz</option>
            {QUIZ_OPTIONS.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr auto", gap: 10, alignItems: "center" }}>
          <input
            ref={muFileRef}
            type="file"
            accept=".ndjson,.jsonl,.json"
            onChange={handleMuFileChange}
            style={{ padding: "6px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          />
          <input
            value={muApiUrl}
            onChange={(e) => setMuApiUrl(e.target.value)}
            placeholder="Bulk API URL"
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
          />
          <button
            onClick={handleMuUpload}
            disabled={muUploading || !muApiUrl || !muSubject || !muTopic || !muQuiz || muQuestions.length === 0}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: muUploading ? "#a855f7" : "#6d28d9", color: "#fff", cursor: muUploading ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: muUploading ? 0.8 : 1 }}
          >
            {muUploading ? "Uploading..." : "Upload"}
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, fontSize: 12, color: "var(--color-text-secondary)" }}>
          <span>File: {muFileName || "None"}</span>
          <span>Total: {muStats.total}</span>
          <span>Ready: {muStats.ready}</span>
          <span>Errors: {muStats.errors}</span>
        </div>

        <div style={{ marginTop: 16 }}>
          <MassImageUpload
            subjectId={selectedSubjectId}
            topicId={selectedTopicId}
            quizId={selectedQuizId}
            subjectName={selectedSubjectName}
            topicName={selectedTopicName}
            quizName={selectedQuizName}
          />
        </div>
      </div>

      {/* ── Mass Solution Upload ── */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <MassSolutionUpload />
      </div>

      {/* ── Bulk Image Upload ── */}
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>Bulk Image Upload</h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
              Upload multiple image questions at once (max {MAX_BULK_IMAGES}). Preview before uploading.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={clearBulkImages}
              disabled={bulkImageUploading || bulkImages.length === 0}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "0.5px solid var(--color-border-secondary)",
                background: "transparent",
                cursor: bulkImageUploading || bulkImages.length === 0 ? "default" : "pointer",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                opacity: bulkImageUploading || bulkImages.length === 0 ? 0.6 : 1,
              }}
            >
              Clear
            </button>
            <button
              onClick={handleBulkImageUpload}
              disabled={bulkImageUploading || bulkImages.length === 0}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "none",
                background: bulkImageUploading ? "#a855f7" : "#6d28d9",
                color: "#fff",
                cursor: bulkImageUploading || bulkImages.length === 0 ? "default" : "pointer",
                fontSize: 12,
                fontWeight: 500,
                opacity: bulkImageUploading || bulkImages.length === 0 ? 0.7 : 1,
              }}
            >
              {bulkImageUploading
                ? "Uploading..."
                : `Upload ${bulkImages.length} image${bulkImages.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              border: "1.5px dashed var(--color-border-secondary)",
              borderRadius: 10,
              padding: "12px 14px",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              background: "var(--color-background-primary)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Choose images</span>
            <span style={{ fontSize: 11, opacity: 0.75 }}>PNG, JPG, WEBP</span>
            <input
              ref={bulkImageRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleBulkImageFiles}
              style={{ display: "none" }}
            />
          </label>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
            {bulkImages.length}/{MAX_BULK_IMAGES} selected
          </div>
        </div>

        {bulkImageNotice && (
          <div style={{ marginTop: 10, fontSize: 12, color: "#b45309" }}>
            {bulkImageNotice}
          </div>
        )}

        {bulkImages.length === 0 ? (
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--color-text-secondary)" }}>
            No images selected yet.
          </div>
        ) : (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {bulkImages.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "0.5px solid var(--color-border-secondary)",
                  borderRadius: 10,
                  padding: 8,
                  background: "var(--color-background-primary)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: 96,
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div style={{ marginTop: 6 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={item.file.name}
                  >
                    {item.file.name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 4,
                      fontSize: 10,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <span>{formatBytes(item.file.size)}</span>
                    <button
                      onClick={() => removeBulkImage(item.id)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "#dc2626",
                        fontSize: 10,
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
                    {q.question ? (
                      <RichContent text={q.question} />
                    ) : q.questionImage ? (
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                        Image question
                      </span>
                    ) : null}
                  </div>
                </td>
                <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                  <button onClick={() => openEdit(q)} style={{ marginRight: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>Edit</button>
                  <button onClick={() => setDeleteConfirm(q.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "0.5px solid #fecaca", background: "transparent", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>Delete</button>
                  {(q.subject === "reasoning" || q.topic === "visual_reasoning") && q.questionImage && (
                    <button
                      onClick={() =>
                        setImagePreview({
                          src: q.questionImage || "",
                          title: q.question || q.id,
                        })
                      }
                      style={{ marginLeft: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}
                    >
                      View Image
                    </button>
                  )}
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

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={() => setImagePreview(null)}
        >
          <div
            style={{
              background: "var(--color-background-primary, #ffffff)",
              borderRadius: 16,
              padding: "1rem",
              width: "100%",
              maxWidth: 860,
              border: "0.5px solid var(--color-border-secondary, #e5e7eb)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {imagePreview.title}
              </div>
              <button
                onClick={() => setImagePreview(null)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--color-text-secondary)" }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                borderRadius: 12,
                border: "0.5px solid var(--color-border-secondary)",
                background: "#f8fafc",
                padding: 10,
              }}
            >
              <img
                src={imagePreview.src}
                alt={imagePreview.title}
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}