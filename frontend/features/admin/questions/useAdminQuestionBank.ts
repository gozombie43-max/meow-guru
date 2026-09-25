"use client";
import {
  EMPTY_Q,
  type Question
} from '@/app/(admin)/admin/admin-question-bank-model';
import { questionWriteResponse as fetchWithRetry } from "@/features/quiz/api/questionWrites";
import { API_BASE } from "@/lib/api-base";
import { getAccessToken } from "@/shared/api/client";
import { useCallback,useEffect,useRef,useState } from "react";
import { useQuestionUploads } from "./useQuestionUploads";

const API = API_BASE;

const getAdminToken = () => getAccessToken() || "";
export function useAdminQuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [facets, setFacets] = useState<{ topics: string[]; exams: string[]; quizNames: string[] }>({ topics: [], exams: [], quizNames: [] });
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

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const filterKey = JSON.stringify([filterTopic, filterSubject, filterDifficulty, filterExam, filterQuizName, search, sortOrder]);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setPage(1);
  }

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



  const topics = facets.topics.filter(Boolean).slice().sort();
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
      if (filterTopic) params.set("topic", filterTopic);
      if (filterSubject) params.set("subject", filterSubject);
      if (filterDifficulty) params.set("difficulty", filterDifficulty);
      if (filterExam) params.set("exam", filterExam);
      if (filterQuizName) params.set("quizName", filterQuizName);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));
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
      setTotalCount(data.count ?? 0);
      const lastPage = Math.max(1, Math.ceil((data.count ?? 0) / PAGE_SIZE));
      if (page > lastPage) setPage(lastPage);
      if (data.facets) setFacets(data.facets);
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
  }, [filterTopic, filterSubject, filterDifficulty, filterExam, filterQuizName, page, search, sortOrder]);

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

  const { muSubject, setMuSubject, muTopic, setMuTopic, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, muTopicOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload } = useQuestionUploads(showMsg);

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

  const paginated = filtered;
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const diffColor = (d: string) =>
    d === "easy" ? "#16a34a" : d === "hard" ? "#dc2626" : "#d97706";
  return { questions, totalCount, loading, error, success, search, setSearch, filterTopic, setFilterTopic, filterSubject, setFilterSubject, filterDifficulty, setFilterDifficulty, filterExam, setFilterExam, filterQuizName, setFilterQuizName, sortOrder, setSortOrder, muSubject, setMuSubject, muTopic, setMuTopic, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, page, setPage, editing, isNew, formData, setFormData, deleteConfirm, setDeleteConfirm, selected, bulkDeleteConfirm, setBulkDeleteConfirm, bulkDeleting, imagePreview, setImagePreview, solImgUploading, solImgRefs, topics, exams, quizNames, muTopicOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, filtered, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload, handleSolutionImageUpload, toggleOne, paginated, allPageSelected, togglePage, selectAll, clearSelection, handleBulkDelete, openEdit, openNew, closeModal, handleSave, handleDelete, totalPages, diffColor };
}
