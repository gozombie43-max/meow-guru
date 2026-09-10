"use client";
import AdminDisclosure from "@/components/admin/AdminDisclosure";
import BulkImageQuestionUpload from "./BulkImageQuestionUpload";
import layout from "@/components/admin/AdminLayout.module.css";
import { ConfirmDialog, ImagePreviewDialog, QuestionEditorDialog } from "./AdminQuestionDialogs";
import MassSolutionUpload from "@/components/admin/MassSolutionUpload";
import RichContent from "@/components/RichContent";
import { API_BASE } from "@/lib/api-base";
import { getAccessToken } from "@/lib/axios";
import { fetchWithRetry } from "@/lib/api/http";
import { useCallback,useEffect,useMemo,useRef,useState,type ChangeEvent } from "react";
import MassImageUpload from "../../../components/admin/MassImageUpload";
import {
  DEFAULT_QUIZ_OPTIONS,
  DIFFICULTIES,
  EMPTY_Q,
  MAX_BULK_IMAGES,
  QUIZ_OPTIONS_BY_TOPIC,
  SUBJECT_OPTIONS,
  SUBJECT_TOPIC_OPTIONS,
  SUBJECTS,
  type BulkImageItem,
  type BulkStats,
  type Question,
  type SubjectKey,
} from "./admin-question-bank-model";

const API = API_BASE;

const getAdminToken = () => getAccessToken() || "";

export default function AdminPanel() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const questionsRequestRef = useRef<AbortController | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterExam, setFilterExam] = useState("");
  const [filterQuizName, setFilterQuizName] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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
  const [solImgUploading, setSolImgUploading] = useState<string | null>(null); // holds question id being uploaded
  const solImgRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootThemeDark = root.classList.contains("theme-dark");
    const previousRootThemeLight = root.classList.contains("theme-light");
    const previousBodyThemeDark = body.classList.contains("theme-dark");
    const previousBodyThemeLight = body.classList.contains("theme-light");
    const previousColorScheme = root.style.colorScheme;

    root.classList.remove("theme-dark");
    root.classList.add("theme-light");
    body.classList.remove("theme-dark");
    body.classList.add("theme-light");
    root.style.colorScheme = "light";

    return () => {
      root.classList.toggle("theme-dark", previousRootThemeDark);
      root.classList.toggle("theme-light", previousRootThemeLight);
      body.classList.toggle("theme-dark", previousBodyThemeDark);
      body.classList.toggle("theme-light", previousBodyThemeLight);
      root.style.colorScheme = previousColorScheme;
    };
  }, []);

  const topics = [...new Set(questions.map((q) => q.topic).filter(Boolean))].sort();
  const exams = [...new Set(questions.map((q) => q.exam).filter(Boolean))].sort();
  const quizNames = [...new Set(
    questions.map((q) => q.quizName || q.source).filter((name): name is string => Boolean(name))
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const muTopicOptions = muSubject ? SUBJECT_TOPIC_OPTIONS[muSubject as SubjectKey] : [];
  const selectedSubjectId = muSubject;
  const selectedTopicId = muTopic;
  const selectedQuizId = muQuiz;
  const selectedSubjectName = SUBJECT_OPTIONS.find((s) => s.value === muSubject)?.label || "";
  const selectedTopicName = muTopicOptions.find((t) => t.value === muTopic)?.label || "";
  const selectedQuizName = muQuiz || "";
  const quizOptions = QUIZ_OPTIONS_BY_TOPIC[muTopic] ?? DEFAULT_QUIZ_OPTIONS;

  const fetchQuestions = useCallback(async () => {
    questionsRequestRef.current?.abort();
    const controller = new AbortController();
    questionsRequestRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filterTopic) params.set("topic", filterTopic);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterExam) params.set("exam", filterExam);
      if (filterQuizName) params.set("quizName", filterQuizName);
      const res = await fetchWithRetry(
        `${API}/api/questions?${params}`,
        { signal: controller.signal },
        { timeoutMs: 30000 }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (questionsRequestRef.current !== controller) return;
      setQuestions(Array.isArray(data) ? data : data.questions || []);
      setSelected(new Set());
      setPage(1);
    } catch (e: unknown) {
      if (!controller.signal.aborted && questionsRequestRef.current === controller) {
        setError(e instanceof Error ? e.message : "Failed to fetch");
      }
    } finally {
      if (questionsRequestRef.current === controller) {
        questionsRequestRef.current = null;
        setLoading(false);
      }
    }
  }, [filterTopic, filterSubject, filterDifficulty, filterExam, filterQuizName]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchQuestions(), 0);
    return () => {
      window.clearTimeout(timer);
      questionsRequestRef.current?.abort();
    };
  }, [fetchQuestions]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const filteredQuestions = questions.filter(
      (x) =>
        !q ||
        x.question?.toLowerCase().includes(q) ||
        x.id?.toLowerCase().includes(q) ||
        x.chapter?.toLowerCase().includes(q)
    );

    const sortedQuestions = filteredQuestions.slice().sort((a, b) => {
      const cmp = a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return sortedQuestions;
  }, [search, questions, sortOrder]);

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

      const secret = getAdminToken();
      const res = await fetchWithRetry(muApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
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
      const secret = getAdminToken();
      const formData = new FormData();
      bulkImages.forEach((item) => formData.append("images", item.file));

      const res = await fetchWithRetry(`${API}/api/upload/bulk-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
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

  const handleSolutionImageUpload = async (questionId: string, file: File) => {
    setSolImgUploading(questionId);
    try {
      const secret = getAdminToken();
      const fd = new FormData();
      fd.append("image", file);

      // Step 1: upload image, get back URL
      const uploadRes = await fetchWithRetry(`${API}/api/upload/solution-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
        body: fd,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed ${uploadRes.status}`);
      const { url } = await uploadRes.json(); // expects { url: "https://..." }

      // Step 2: patch the question's solution field with image markdown
      const patchRes = await fetchWithRetry(`${API}/api/questions/${encodeURIComponent(questionId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ solution: `![solution](${url})` }),
      });
      if (!patchRes.ok) throw new Error(`Patch failed ${patchRes.status}`);

      showMsg("Solution image uploaded ✓");
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Solution image upload failed", true);
    } finally {
      setSolImgUploading(null);
    }
  };

  // ── Checkbox helpers ──────────────────────────────────
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    const idsToDelete = Array.from(selected);
    const secret = getAdminToken();
    let deleted = 0;
    let failed = 0;

    try {
      // 1. Try fast batch bulk delete endpoint first
      const res = await fetchWithRetry(`${API}/api/questions/bulk-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        deleted = Number.isFinite(data?.deleted) ? data.deleted : idsToDelete.length;
        failed = Number.isFinite(data?.failed) ? data.failed : 0;
      } else {
        // 2. Fallback to concurrent chunked single deletes if bulk-delete endpoint is unavailable
        const results = await Promise.allSettled(
          idsToDelete.map((id) =>
            fetchWithRetry(`${API}/api/questions/${encodeURIComponent(id)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${secret}` },
            })
          )
        );
        results.forEach((r) => {
          if (r.status === "fulfilled" && r.value.ok) deleted++;
          else failed++;
        });
      }

      // Optimistically remove deleted questions from local state
      setQuestions((prev) => prev.filter((q) => !selected.has(q.id)));
      setSelected(new Set());
      setBulkDeleteConfirm(false);
      showMsg(failed > 0 ? `Deleted ${deleted}, failed ${failed}` : `Deleted ${deleted} questions ✓`);
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Bulk delete failed", true);
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Single CRUD ───────────────────────────────────────
  const openEdit = (q: Question) => { setEditing(q); setIsNew(false); setFormData({ ...q }); };
  const openNew = () => { setEditing({ id: "" } as Question); setIsNew(true); setFormData({ ...EMPTY_Q }); };
  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async () => {
    try {
      const secret = getAdminToken();
      if (isNew) {
        const res = await fetchWithRetry(`${API}/api/questions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          let msg = `Server error ${res.status}`;
          try {
            const d = await res.json();
            if (d?.error) msg = d.error;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
        showMsg("Question created ✓");
      } else {
        const res = await fetchWithRetry(`${API}/api/questions/${editing!.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          let msg = `Server error ${res.status}`;
          try {
            const d = await res.json();
            if (d?.error) msg = d.error;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
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
      const secret = getAdminToken();
      const res = await fetchWithRetry(`${API}/api/questions/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      });
      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData?.error) msg = errData.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      showMsg("Question deleted ✓");
      setDeleteConfirm(null);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Delete failed", true);
    }
  };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const diffColor = (d: string) =>
    d === "easy" ? "#16a34a" : d === "hard" ? "#dc2626" : "#d97706";

  return (
    <div className={layout.page}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>Question Bank Admin</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0" }}>
            {filtered.length} of {questions.length} questions
            {selected.size > 0 && <span style={{ marginLeft: 8, color: "var(--admin-blue)", fontWeight: 500 }}>· {selected.size} selected</span>}
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
          <a
            href="/admin/upload"
            style={{ padding: "8px 14px", background: "transparent", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, cursor: "pointer", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Upload Tools
          </a>
          <button onClick={openNew} style={{ padding: "8px 16px", background: "var(--admin-blue)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
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
      <AdminDisclosure title="Import questions and images">
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 10, marginBottom: 10 }}>
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
            {quizOptions.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10, alignItems: "center" }}>
          <input
            ref={muFileRef}
            type="file"
            accept=".ndjson,.jsonl,.json"
            onChange={handleMuFileChange}
            style={{ padding: "6px 10px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 12, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
           aria-label="Choose file"/>
          <input
            value={muApiUrl}
            onChange={(e) => setMuApiUrl(e.target.value)}
            placeholder="Bulk API URL"
            style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 13, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}
           aria-label="Bulk API URL"/>
          <button
            onClick={handleMuUpload}
            disabled={muUploading || !muApiUrl || !muSubject || !muTopic || !muQuiz || muQuestions.length === 0}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: muUploading ? "#a855f7" : "var(--admin-blue)", color: "#fff", cursor: muUploading ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: muUploading ? 0.8 : 1 }}
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

      </AdminDisclosure>

      {/* ── Mass Solution Upload ── */}
      <AdminDisclosure title="Upload solution images">
      <div style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem", marginBottom: "1rem", background: "var(--color-background-secondary)" }}>
        <MassSolutionUpload />
      </div>

      </AdminDisclosure>

      <BulkImageQuestionUpload
        busy={bulkImageUploading}
        fileInputRef={bulkImageRef}
        items={bulkImages}
        notice={bulkImageNotice}
        onClear={clearBulkImages}
        onFilesChange={handleBulkImageFiles}
        onRemove={removeBulkImage}
        onUpload={handleBulkImageUpload}
      />

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))", gap: 10, marginBottom: "1rem" }}>
        <input placeholder="Search question, chapter, ID..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}  aria-label="Search question, chapter, ID..."/>
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
        <select value={filterQuizName} onChange={(e) => setFilterQuizName(e.target.value)}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="">All quiz names</option>
          {quizNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
          style={{ padding: "8px 12px", border: "0.5px solid var(--color-border-secondary)", borderRadius: 8, fontSize: 14, background: "var(--color-background-primary)", color: "var(--color-text-primary)" }}>
          <option value="asc">Sort by ID ↑</option>
          <option value="desc">Sort by ID ↓</option>
        </select>
      </div>

      {/* Select all banner */}
      {selected.size > 0 && (
        <div style={{ padding: "8px 14px", background: "var(--admin-blue-soft)", borderRadius: 8, marginBottom: 10, fontSize: 13, color: "var(--admin-blue)", display: "flex", alignItems: "center", gap: 12 }}>
          <span>{selected.size} question{selected.size > 1 ? "s" : ""} selected</span>
          {selected.size < filtered.length && (
            <button onClick={selectAll} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-blue)", fontWeight: 500, fontSize: 13, padding: 0 }}>
              Select all {filtered.length}
            </button>
          )}
          <button onClick={clearSelection} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--admin-blue)", fontSize: 13, padding: 0, marginLeft: "auto" }}>
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className={layout.tableWrap}>
        <table className={layout.table}>
          <thead>
            <tr style={{ background: "var(--color-background-secondary)" }}>
              <th style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", width: 40 }}>
                <input type="checkbox" checked={allPageSelected} onChange={togglePage}
                  style={{ cursor: "pointer", width: 15, height: 15 }} title="Select all on this page"  aria-label="Select all on this page"/>
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
                background: selected.has(q.id) ? "var(--admin-blue-soft)" : i % 2 === 0 ? "var(--color-background-primary)" : "var(--color-background-secondary)"
              }}>
                <td data-label="Select" style={{ padding: "10px 14px" }}>
                  <input type="checkbox" checked={selected.has(q.id)} onChange={() => toggleOne(q.id)}
                    style={{ cursor: "pointer", width: 15, height: 15 }} aria-label={`Select question ${q.id}`} />
                </td>
                <td data-label="ID" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{q.id?.slice(0, 16)}...</td>
                <td data-label="Topic" style={{ padding: "10px 14px" }}>
                  <span style={{ background: "var(--admin-blue-soft)", color: "var(--admin-blue)", padding: "2px 8px", borderRadius: 6, fontSize: 12 }}>{q.topic}</span>
                </td>
                <td data-label="Chapter" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.chapter}</td>
                <td data-label="Difficulty" style={{ padding: "10px 14px" }}>
                  <span style={{ color: diffColor(q.difficulty), fontWeight: 500, fontSize: 12 }}>{q.difficulty}</span>
                </td>
                <td data-label="Exam" style={{ padding: "10px 14px", color: "var(--color-text-secondary)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{q.exam}</td>
                <td data-label="Question" style={{ padding: "10px 14px", maxWidth: 320 }}>
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
                <td data-label="Actions" style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                  <button onClick={() => openEdit(q)} style={{ marginRight: 6, padding: "4px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-primary)" }}>Edit</button>
                  <button onClick={() => setDeleteConfirm(q.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "0.5px solid #fecaca", background: "transparent", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>Delete</button>
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      ref={(el) => { solImgRefs.current[q.id] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSolutionImageUpload(q.id, file);
                        e.target.value = "";
                      }}
                     aria-label="Choose file"/>
                    <button
                      onClick={() => solImgRefs.current[q.id]?.click()}
                      disabled={solImgUploading === q.id}
                      style={{
                        marginLeft: 6,
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "0.5px solid #bbf7d0",
                        background: "transparent",
                        cursor: solImgUploading === q.id ? "wait" : "pointer",
                        fontSize: 12,
                        color: "#16a34a",
                        opacity: solImgUploading === q.id ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {solImgUploading === q.id ? "Uploading..." : `${(q.solutionImage || q.solution?.includes("![solution](")) ? "✓ " : ""}Sol. Image`}
                    </button>
                  </>
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
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: "1rem", justifyContent: "center" }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>«</button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", borderRadius: 6, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: page === totalPages ? "default" : "pointer", opacity: page === totalPages ? 0.4 : 1 }}>»</button>
        </div>
      )}

      {editing && (
        <QuestionEditorDialog
          formData={formData}
          isNew={isNew}
          onClose={closeModal}
          onSave={handleSave}
          setFormData={setFormData}
        />
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete question?"
          description="This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm)}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title={`Delete ${selected.size} questions?`}
          description={`This will permanently delete all ${selected.size} selected questions. This cannot be undone.`}
          confirmLabel={`Delete ${selected.size} questions`}
          busy={bulkDeleting}
          onCancel={() => setBulkDeleteConfirm(false)}
          onConfirm={handleBulkDelete}
        />
      )}

      {imagePreview && (
        <ImagePreviewDialog preview={imagePreview} onClose={() => setImagePreview(null)} />
      )}
    </div>
  );
}
