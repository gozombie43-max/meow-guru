"use client";
import {
  EMPTY_Q,
  filterTopicsForSubject,
  getGeneralAwarenessChaptersForTopic,
  isTopicAllowedForSubject,
  normalizeSubjectKey,
  resolveGeneralAwarenessQuestionTaxonomy,
  SUBJECT_TOPIC_OPTIONS,
  questionReference,
  type Question
} from '@/app/(admin)/admin/admin-question-bank-model';
import { questionWriteResponse as fetchWithRetry } from "@/features/quiz/api/questionWrites";
import { API_BASE } from "@/lib/api-base";
import { getAccessToken } from "@/shared/api/client";
import { useCallback,useEffect,useRef,useState } from "react";
import { useQuestionUploads } from "./useQuestionUploads";
import { useExamMode } from '@/context/ExamModeContext';
import { adminScopedUrl, getAdminExamCatalog, prepareAdminQuestion } from '@/lib/admin-exam-mode';
import { JAM_SUBJECT } from '@/lib/exam-mode';

const API = API_BASE;

const getAdminToken = () => getAccessToken() || "";
export function useAdminQuestionBank() {
  const { mode, isJam } = useExamMode();
  const scopedUrl = (url: string) => adminScopedUrl(url, mode);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<{ topics: string[]; exams: string[]; quizNames: string[] }>({ topics: [], exams: [], quizNames: [] });
  const [subjectFacets, setSubjectFacets] = useState<Record<string, { topics: string[]; exams: string[]; quizNames: string[] }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const questionsRequestRef = useRef<AbortController | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopicState] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [filterSubject, setFilterSubject] = useState(isJam ? JAM_SUBJECT : "");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterExam, setFilterExam] = useState("");
  const [filterQuizName, setFilterQuizName] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSetFilterSubject = useCallback((next: string) => {
    setFilterSubject(next);
    setFilterTopicState((topic) => isTopicAllowedForSubject(topic, next) ? topic : "");
    setFilterChapter("");
    const cached = subjectFacets[next || "all"];
    if (cached) {
      setFacets(cached);
    }
  }, [subjectFacets]);

  const setFilterTopic = useCallback((next: string) => {
    setFilterTopicState(next);
    setFilterChapter("");
  }, []);

  // Pagination
  const [page, setPage] = useState(1);
  const cursorsRef = useRef<{ filter: string; pages: Map<number, { cursor: string; before?: boolean }> }>({ filter: '', pages: new Map() });
  const PAGE_SIZE = 50;
  const filterKey = JSON.stringify([mode, filterTopic, filterChapter, filterSubject, filterDifficulty, filterExam, filterQuizName, search, sortOrder]);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  // Modal
  const [editing, setEditing] = useState<Question | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formData, setFormData] = useState<Omit<Question, "id">>(EMPTY_Q);
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectingAll, setSelectingAll] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setPage(1);
    setSelected(new Set());
  }
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    title: string;
  } | null>(null);
  const [solImgUploading, setSolImgUploading] = useState<string | null>(null); // holds question id being uploaded
  const solImgRefs = useRef<Record<string, HTMLInputElement | null>>({});



  const isGeneralAwarenessFilter = !isJam && normalizeSubjectKey(filterSubject) === "generalawareness";
  const topics = isJam
    ? getAdminExamCatalog(mode).subjectTopics[JAM_SUBJECT].map(topic => topic.value)
    : isGeneralAwarenessFilter
      ? SUBJECT_TOPIC_OPTIONS["general-awareness"].map((topic) => topic.value)
      : filterTopicsForSubject(facets.topics.filter(Boolean), filterSubject).slice().sort();
  const chapters = isGeneralAwarenessFilter && filterTopic ? getGeneralAwarenessChaptersForTopic(filterTopic) : [];
  const exams = facets.exams.filter(Boolean).slice().sort();
  const quizNames = facets.quizNames.filter(Boolean).slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const fetchQuestions = useCallback(async () => {
    questionsRequestRef.current?.abort();
    const controller = new AbortController();
    questionsRequestRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set('examMode', mode);
      if (filterTopic) params.set("topic", filterTopic);
      if (filterChapter) params.set("chapter", filterChapter);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterExam) params.set("exam", filterExam);
      if (filterQuizName) params.set("quizName", filterQuizName);
      params.set('limit', String(PAGE_SIZE));
      params.set('pagination', 'cursor');
      if (cursorsRef.current.filter !== filterKey) cursorsRef.current = { filter: filterKey, pages: new Map() };
      const boundary = cursorsRef.current.pages.get(page);
      if (page > 1 && boundary) {
        params.set('cursor', boundary.cursor);
        if (boundary.before) params.set('before', 'true');
      } else if (page > 1) params.set('last', 'true');
      if (page === 1 || params.has('last')) params.set('includeTotal', 'true');
      params.set('sort', sortOrder);
      if (search) params.set('search', search);
      if (page === 1) params.set('includeFacets', 'true');
      const res = await fetchWithRetry(
        `${API}/api/questions?${params}`,
        { signal: controller.signal },
        { timeoutMs: 30000 }
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (questionsRequestRef.current !== controller) return;
      setQuestions(Array.isArray(data) ? data : data.questions || []);
      if (data.total !== undefined) {
        setTotalCount(data.total);
        const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
        if (page > lastPage) { cursorsRef.current.pages.clear(); setPage(lastPage); }
      }
      if (data.nextCursor) cursorsRef.current.pages.set(page + 1, { cursor: data.nextCursor });
      if (data.prevCursor) cursorsRef.current.pages.set(page - 1, { cursor: data.prevCursor, before: true });
      if (!data.questions?.length && page > 1) { cursorsRef.current.pages.clear(); setPage(1); }
      if (data.facets) {
        setFacets(data.facets);
        setSubjectFacets((prev) => ({ ...prev, [filterSubject || "all"]: data.facets }));
      }
      setSelected(new Set());
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
  }, [mode, filterTopic, filterChapter, filterSubject, filterDifficulty, filterExam, filterQuizName, page, search, sortOrder, filterKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchQuestions(), 200);
    return () => {
      window.clearTimeout(timer);
      questionsRequestRef.current?.abort();
    };
  }, [fetchQuestions]);

  const filtered = questions;

  const showMsg = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(""); setSuccess(""); }, 3000);
  };

  const { muSubject, setMuSubject, muTopic, setMuTopic, muChapter, setMuChapter, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, muTopicOptions, muChapterOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload } = useQuestionUploads(showMsg);

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
      const patchRes = await fetchWithRetry(scopedUrl(`${API}/api/questions/${encodeURIComponent(questionId)}`), {
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

  const paginated = filtered;
  const paginatedIds = paginated.map(questionReference);
  const allPageSelected = paginatedIds.length > 0 && paginatedIds.every((id) => selected.has(id));
  const allMatchingSelected = totalCount > 0 && selected.size >= totalCount;

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
    setSelected(new Set(filtered.map(questionReference)));
  };

  const selectAllMatching = async () => {
    if (selectingAll) return;
    if (totalCount > 0 && filtered.length >= totalCount) {
      const ids = filtered.map((q) => q.id).filter(Boolean);
      setSelected(new Set(ids));
      showMsg(`Selected all ${ids.length} question${ids.length === 1 ? "" : "s"} ✓`);
      return;
    }
    setSelectingAll(true);
    try {
      const secret = getAdminToken();
      const params = new URLSearchParams();
      params.set("examMode", mode);
      params.set("format", "json");
      params.set("fields", "identity");
      if (filterSubject) params.set("subject", filterSubject);
      if (filterTopic) params.set("topic", filterTopic);
      if (filterChapter) params.set("chapter", filterChapter);
      if (filterQuizName) params.set("quizName", filterQuizName);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterExam) params.set("exam", filterExam);
      if (search) params.set("search", search);
      params.set("sort", sortOrder);

      const res = await fetchWithRetry(
        `${API}/api/questions/export?${params.toString()}`,
        { headers: { Authorization: `Bearer ${secret}` } },
        { timeoutMs: 60000 }
      );
      if (!res.ok) {
        let msg = `Failed to select all questions (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) msg = errData.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      let ids: string[] = [];
      if (typeof res.json === "function") {
        try {
          const data = await res.json();
          if (Array.isArray(data?.ids)) {
            ids = data.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean);
          } else {
            const list = Array.isArray(data) ? data : data?.questions || [];
            ids = list
              .map((q: Pick<Question, "id" | "questionUid">) => questionReference(q).trim())
              .filter(Boolean);
          }
        } catch {
          // fallback if response was NDJSON text
        }
      }
      if (ids.length === 0 && typeof res.text === "function") {
        const text = await res.text();
        ids = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            try {
              return questionReference(JSON.parse(line) as Pick<Question, "id" | "questionUid">).trim();
            } catch {
              return "";
            }
          })
          .filter(Boolean);
      }

      if (ids.length === 0) {
        showMsg("No matching questions found to select", true);
        return;
      }

      setSelected(new Set(ids));
      showMsg(`Selected all ${ids.length} question${ids.length === 1 ? "" : "s"} ✓`);
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Failed to select all matching questions", true);
    } finally {
      setSelectingAll(false);
    }
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
      const BATCH_SIZE = 100;
      const deleteParams = new URLSearchParams();
      if (filterTopic) deleteParams.set("topic", filterTopic);
      if (filterSubject) deleteParams.set("subject", filterSubject);
      const bulkDeleteUrl = scopedUrl(`${API}/api/questions/bulk-delete${deleteParams.size ? `?${deleteParams}` : ""}`);
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batchIds = idsToDelete.slice(i, i + BATCH_SIZE);
        // 1. Try fast batch bulk delete endpoint first
        const res = await fetchWithRetry(
          bulkDeleteUrl,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${secret}`,
            },
            body: JSON.stringify({ ids: batchIds }),
          },
          { timeoutMs: 60000 }
        );

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          deleted += Number.isFinite(data?.deleted) ? data.deleted : batchIds.length;
          failed += Number.isFinite(data?.failed) ? data.failed : 0;
        } else {
          // 2. Fallback to concurrent chunked single deletes if bulk-delete endpoint is unavailable
          const results = await Promise.allSettled(
            batchIds.map((id) =>
              fetchWithRetry(scopedUrl(`${API}/api/questions/${encodeURIComponent(id)}`), {
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
      }

      // Optimistically remove deleted questions from local state
      setQuestions((prev) => prev.filter((q) => !selected.has(questionReference(q))));
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
  const openEdit = (q: Question) => {
    const key = (value: string) => {
      const normalized = value.toLowerCase().replace(/[-_\s]/g, '');
      return normalized === 'logicalreasoning' ? 'reasoning' : ['math', 'quant'].includes(normalized) ? 'mathematics' : normalized;
    };
    const subject = getAdminExamCatalog(mode).subjectOptions.find(option => key(option.value) === key(q.subject))?.value || q.subject;
    const gaTaxonomy = normalizeSubjectKey(subject) === "generalawareness" ? resolveGeneralAwarenessQuestionTaxonomy(q) : null;
    setEditing(q);
    setIsNew(false);
    setFormData({
      ...q,
      subject,
      ...(gaTaxonomy?.topicSlug ? { topic: gaTaxonomy.topicSlug } : {}),
      ...(gaTaxonomy?.chapterTitle ? { chapter: gaTaxonomy.chapterTitle } : {}),
    });
  };
  const openNew = () => { setEditing({ id: "" } as Question); setIsNew(true); setFormData({ ...EMPTY_Q, ...(isJam ? { subject: JAM_SUBJECT, exam: 'IIT JAM Physics' } : {}) }); };
  const closeModal = () => { setEditing(null); setIsNew(false); };

  const handleSave = async () => {
    try {
      const secret = getAdminToken();
      const payload = prepareAdminQuestion(formData, mode, formData.subject, formData.topic, formData.chapter);
      if (isNew) {
        const res = await fetchWithRetry(scopedUrl(`${API}/api/questions`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(payload),
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
        const res = await fetchWithRetry(scopedUrl(`${API}/api/questions/${encodeURIComponent(editing!.id)}`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${secret}`,
          },
          body: JSON.stringify(payload),
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

  const handleDelete = async (question: Question) => {
    try {
      const secret = getAdminToken();
      const reference = questionReference(question);
      const deleteParams = new URLSearchParams();
      if (question.topic) deleteParams.set("topic", question.topic);
      if (question.subject) deleteParams.set("subject", question.subject);
      const res = await fetchWithRetry(scopedUrl(`${API}/api/questions/${encodeURIComponent(reference)}?${deleteParams}`), {
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
      setQuestions((prev) => prev.filter((q) => questionReference(q) !== reference));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(reference);
        return next;
      });
      fetchQuestions();
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Delete failed", true);
    }
  };

  const handleDownloadNdjson = async (overrides?: { subject?: string; topic?: string; chapter?: string; quizName?: string; ids?: string[] }) => {
    if (exporting) return;
    setExporting(true);
    try {
      const secret = getAdminToken();
      const params = new URLSearchParams();
      params.set("examMode", mode);
      const subj = overrides?.subject !== undefined ? overrides.subject : filterSubject;
      const top = overrides?.topic !== undefined ? overrides.topic : filterTopic;
      const chap = overrides?.chapter !== undefined ? overrides.chapter : filterChapter;
      const qName = overrides?.quizName !== undefined ? overrides.quizName : filterQuizName;
      if (subj) params.set("subject", subj);
      if (top) params.set("topic", top);
      if (chap) params.set("chapter", chap);
      if (qName) params.set("quizName", qName);
      if (!overrides || overrides.ids) {
        if (filterDifficulty) params.set("difficulty", filterDifficulty);
        if (filterExam) params.set("exam", filterExam);
        if (search) params.set("search", search);
      }
      params.set("sort", sortOrder);
      if (overrides?.ids?.length && !(totalCount > 0 && overrides.ids.length >= totalCount)) {
        params.set("ids", overrides.ids.join(","));
      }

      const res = await fetchWithRetry(
        `${API}/api/questions/export?${params.toString()}`,
        { headers: { Authorization: `Bearer ${secret}` } },
        { timeoutMs: 60000 }
      );
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) msg = errData.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const text = await res.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length === 0) {
        showMsg("No matching questions found to download", true);
        return;
      }

      const slugParts = [
        mode || "ssc",
        subj || "all-subjects",
        top || "all-topics",
        chap,
        qName,
        !overrides ? filterDifficulty : "",
      ]
        .filter(Boolean)
        .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean);
      const filename = `${slugParts.join("-") || "questions"}.ndjson`;

      const blob = new Blob([text], { type: "application/x-ndjson;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showMsg(`Downloaded ${lines.length} question${lines.length === 1 ? "" : "s"} (${filename}) ✓`);
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : "Download failed", true);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const diffColor = (d: string) =>
    d === "easy" ? "#16a34a" : d === "hard" ? "#dc2626" : "#d97706";
  return { questions, totalCount, loading, error, success, search, setSearch, filterTopic, setFilterTopic, filterChapter, setFilterChapter, filterSubject, setFilterSubject: handleSetFilterSubject, filterDifficulty, setFilterDifficulty, filterExam, setFilterExam, filterQuizName, setFilterQuizName, sortOrder, setSortOrder, muSubject, setMuSubject, muTopic, setMuTopic, muChapter, setMuChapter, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, page, setPage, editing, isNew, formData, setFormData, deleteConfirm, setDeleteConfirm, selected, selectingAll, allMatchingSelected, bulkDeleteConfirm, setBulkDeleteConfirm, bulkDeleting, exporting, handleDownloadNdjson, imagePreview, setImagePreview, solImgUploading, solImgRefs, topics, chapters, exams, quizNames, muTopicOptions, muChapterOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, filtered, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload, handleSolutionImageUpload, toggleOne, paginated, allPageSelected, togglePage, selectAll, selectAllMatching, clearSelection, handleBulkDelete, openEdit, openNew, closeModal, handleSave, handleDelete, totalPages, diffColor, fetchQuestions };
}
