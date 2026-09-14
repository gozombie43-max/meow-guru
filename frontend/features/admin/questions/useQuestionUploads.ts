"use client";
import {
  DEFAULT_QUIZ_OPTIONS,
  MAX_BULK_IMAGES,
  QUIZ_OPTIONS_BY_TOPIC,
  SUBJECT_OPTIONS,
  SUBJECT_TOPIC_OPTIONS,
  type BulkImageItem,
  type BulkStats,
  type SubjectKey
} from '@/app/(admin)/admin/admin-question-bank-model';
import { questionWriteResponse as fetchWithRetry } from "@/features/quiz/api/questionWrites";
import { API_BASE } from "@/lib/api-base";
import { getAccessToken } from "@/shared/api/client";
import { useRef,useState,type ChangeEvent } from "react";

const API = API_BASE;

const getAdminToken = () => getAccessToken() || "";
export function useQuestionUploads(showMsg: (message: string, isError?: boolean) => void) {
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

  const muTopicOptions = muSubject ? SUBJECT_TOPIC_OPTIONS[muSubject as SubjectKey] : [];
  const selectedSubjectId = muSubject;
  const selectedTopicId = muTopic;
  const selectedQuizId = muQuiz;
  const selectedSubjectName = SUBJECT_OPTIONS.find((s) => s.value === muSubject)?.label || "";
  const selectedTopicName = muTopicOptions.find((t) => t.value === muTopic)?.label || "";
  const selectedQuizName = muQuiz || "";
  const quizOptions = QUIZ_OPTIONS_BY_TOPIC[muTopic] ?? DEFAULT_QUIZ_OPTIONS;

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

  return { muSubject, setMuSubject, muTopic, setMuTopic, muQuiz, setMuQuiz, muFileName, muStats, muQuestions, muUploading, muApiUrl, setMuApiUrl, muFileRef, bulkImages, bulkImageNotice, bulkImageUploading, bulkImageRef, muTopicOptions, selectedSubjectId, selectedTopicId, selectedQuizId, selectedSubjectName, selectedTopicName, selectedQuizName, quizOptions, handleMuFileChange, handleMuClear, handleMuUpload, handleBulkImageFiles, removeBulkImage, clearBulkImages, handleBulkImageUpload };
}
