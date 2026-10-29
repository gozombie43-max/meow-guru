"use client";

import React, { useEffect, useRef, useState } from "react";
import { useExamMode } from "@/context/ExamModeContext";
import { adminScopedUrl } from "@/lib/admin-exam-mode";
import { API_BASE } from "@/lib/api-base";
import { type ExamMode } from "@/lib/exam-mode";
import { requestResponse } from "@/shared/api/request";
import styles from "./QuestionBankZipUpload.module.css";

export type ZipStage =
  | "idle"
  | "selected"
  | "validating"
  | "ready"
  | "uploading"
  | "success"
  | "error";

export interface TargetPreview {
  questionId: string;
  target: "question" | "solution" | "option";
  file: string;
  option?: string;
  language?: string;
  replaces?: boolean;
  replacesExisting?: boolean;
  status?: string;
}

export interface ZipValidationSummary {
  questionCount: number;
  fileCount: number;
  targetCount: number;
  targets: TargetPreview[];
  expectedUpdatedAts?: Record<string, string | null>;
}

export interface ZipStatus {
  stage: ZipStage;
  message: string;
  filename?: string;
}

export interface QuestionBankZipUploadProps {
  examMode?: string;
  onRefresh?: () => void;
  onSuccess?: (result?: unknown) => void;
  onError?: (error: Error | string) => void;
  onComplete?: (result?: unknown) => void;
  className?: string;
}

export function createManifestTemplate(examMode: string = "ssc") {
  const normalizedMode = examMode === "iit-jam" ? "iit-jam" : "ssc";
  return {
    version: 1,
    examMode: normalizedMode,
    images: [
      {
        questionId: "65b123456789abcdef000001",
        target: "question",
        file: "images/q1-diagram.png",
      },
      {
        questionId: "65b123456789abcdef000001",
        target: "solution",
        file: "images/q1-solution.png",
      },
      {
        questionId: "65b123456789abcdef000001",
        target: "option",
        option: "A",
        language: "en",
        file: "images/q1-opt-a.jpg",
      },
      {
        questionId: "65b123456789abcdef000001",
        target: "option",
        option: "B",
        language: "bn",
        file: "images/q1-opt-b-bn.webp",
      },
      {
        questionId: "65b123456789abcdef000002",
        target: "question",
        file: "images/q2-figure.png",
      },
    ],
  };
}

interface ZipApiResponse {
  error?: unknown;
  message?: string;
  valid?: boolean;
  success?: boolean;
  appliedCount?: number;
  questionCount?: number;
  summary?: ZipValidationSummary;
  expectedUpdatedAts?: Record<string, string | null>;
  [key: string]: unknown;
}

function errorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;

  const detail = value as Record<string, unknown>;
  for (const key of ["message", "detail", "title", "error_description"]) {
    const message = errorMessage(detail[key]);
    if (message) return message;
  }

  if (typeof detail.code === "string" && detail.code.trim()) {
    return `Request failed (${detail.code.trim()}).`;
  }
  return null;
}

async function readResponse(response: Response): Promise<ZipApiResponse> {
  let data: ZipApiResponse = {};
  try {
    data = (await response.json()) as ZipApiResponse;
  } catch {
    data = {};
  }
  if (!response.ok || data?.error) {
    throw new Error(
      errorMessage(data?.error) ||
      errorMessage(data) ||
      `Request failed with status ${response.status}`
    );
  }
  return data;
}

export function QuestionBankZipUpload({
  examMode: propExamMode,
  onRefresh,
  onSuccess,
  onError,
  onComplete,
  className,
}: QuestionBankZipUploadProps) {
  const { mode: contextMode } = useExamMode();
  const mode = propExamMode || contextMode || "ssc";

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipPreview, setZipPreview] = useState<ZipValidationSummary | null>(null);
  const [expectedUpdatedAts, setExpectedUpdatedAts] = useState<Record<string, string | null>>({});
  const [zipStatus, setZipStatus] = useState<ZipStatus>({
    stage: "idle",
    message: "Choose a ZIP to begin.",
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = zipStatus.stage === "validating" || zipStatus.stage === "uploading";

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const downloadManifest = () => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    const template = createManifestTemplate(mode);
    const jsonContent = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8" });

    let objectUrl: string | null = null;
    const anchor = document.createElement("a");
    anchor.download = "manifest.json";
    anchor.style.display = "none";

    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      try {
        objectUrl = URL.createObjectURL(blob);
        anchor.href = objectUrl;
      } catch {
        anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}`;
      }
    } else {
      anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(jsonContent)}`;
    }

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (objectUrl && typeof URL.revokeObjectURL === "function") {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl as string);
        } catch {
          // ignore
        }
      }, 100);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setZipPreview(null);
    setExpectedUpdatedAts({});

    if (!file) {
      setZipFile(null);
      setZipStatus({ stage: "idle", message: "Choose a ZIP to begin." });
      return;
    }

    if (!/\.zip$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      setZipFile(null);
      const errMsg = "Choose a .zip file no larger than 20 MiB. Split larger uploads.";
      setZipStatus({
        stage: "error",
        filename: file.name,
        message: errMsg,
      });
      onError?.(errMsg);
    } else {
      setZipFile(file);
      setZipStatus({
        stage: "selected",
        filename: file.name,
        message: "ZIP selected. Validate it before uploading.",
      });
    }
  };

  const handleValidate = async () => {
    if (!zipFile || isBusy) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setZipStatus({
      stage: "validating",
      filename: zipFile.name,
      message: "Validating ZIP and checking image targets…",
    });

    try {
      const body = new FormData();
      body.append("zipFile", zipFile);
      body.append("action", "validate");

      const endpoint = adminScopedUrl(`${API_BASE}/api/questions/admin/image-zip`, mode as ExamMode);
      const res = await requestResponse(
        endpoint,
        { method: "POST", body, signal: controller.signal },
        { timeoutMs: 180000 }
      );
      const data = await readResponse(res);
      if (controller.signal.aborted) return;

      const summary: ZipValidationSummary = data.summary || (data as unknown as ZipValidationSummary);
      setZipPreview(summary);
      setExpectedUpdatedAts(summary.expectedUpdatedAts || data.expectedUpdatedAts || {});
      setZipStatus({
        stage: "ready",
        filename: zipFile.name,
        message: "ZIP validated. Review the targets below, then upload.",
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Validation failed.";
      setZipPreview(null);
      setExpectedUpdatedAts({});
      setZipStatus({
        stage: "error",
        filename: zipFile.name,
        message,
      });
      onError?.(message);
    }
  };

  const handleApply = async () => {
    if (!zipFile || !zipPreview || isBusy || zipStatus.stage !== "ready") return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentFilename = zipFile.name;

    setZipStatus({
      stage: "uploading",
      filename: currentFilename,
      message: "Uploading images to B2 and saving question links…",
    });

    try {
      const body = new FormData();
      body.append("zipFile", zipFile);
      body.append("action", "apply");
      body.append("expectedUpdatedAts", JSON.stringify(expectedUpdatedAts));

      const endpoint = adminScopedUrl(`${API_BASE}/api/questions/admin/image-zip`, mode as ExamMode);
      const res = await requestResponse(
        endpoint,
        { method: "POST", body, signal: controller.signal },
        { timeoutMs: 180000 }
      );
      const data = await readResponse(res);
      if (controller.signal.aborted) return;

      const successMessage =
        data.message ||
        `Successfully updated ${data.questionCount || 0} question(s) with ${data.appliedCount || 0} image(s).`;

      setZipFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setZipStatus({
        stage: "success",
        filename: currentFilename,
        message: successMessage,
      });

      onSuccess?.(data);
      onRefresh?.();
      onComplete?.(data);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Could not import ZIP.";
      setZipStatus({
        stage: "error",
        filename: currentFilename,
        message: `${message} Reload questions to check their state before retrying.`,
      });
      onError?.(message);
    }
  };

  return (
    <div className={`${styles.root} ${className || ""}`}>
      <div className={styles.header}>
        <h3>Bulk upload question, solution &amp; option images (.zip)</h3>
        <p>
          Attach illustrations, diagram scans, and solution notes to existing Question Bank questions in {mode.toUpperCase()} mode.
        </p>
      </div>

      <div className={styles.actionsBar} role="group" aria-label="Documentation and template actions">
        <a
          href="/docs/question-bank-image-zip-policy.md"
          download="question-bank-image-zip-policy.md"
          data-ui-button="secondary"
          className={styles.policyLink}
        >
          Download ZIP format &amp; policy (.md)
        </a>
        <button
          type="button"
          data-ui-button="secondary"
          disabled={isBusy}
          onClick={downloadManifest}
        >
          Download manifest template
        </button>
      </div>

      <div className={styles.fileRow}>
        <label htmlFor="qb-zip-file-input" className={styles.fileLabel}>
          Question Bank image ZIP
        </label>
        <input
          id="qb-zip-file-input"
          ref={fileInputRef}
          aria-label="Question Bank image ZIP"
          type="file"
          accept=".zip,application/zip"
          disabled={isBusy}
          onChange={handleFileChange}
        />
      </div>

      <div className={styles.buttonRow}>
        <button
          type="button"
          data-ui-button="secondary"
          disabled={!zipFile || isBusy}
          onClick={handleValidate}
        >
          {zipStatus.stage === "validating" ? "Validating ZIP…" : "Validate ZIP"}
        </button>
        <button
          type="button"
          data-ui-button="primary"
          className={styles.primary}
          disabled={zipStatus.stage !== "ready" || !zipPreview || !zipFile || isBusy}
          onClick={handleApply}
        >
          {zipStatus.stage === "uploading" ? "Uploading & linking…" : "Upload & link images"}
        </button>
      </div>

      <div
        className={styles.zipStatus}
        data-stage={zipStatus.stage}
        role={zipStatus.stage === "error" ? "alert" : "status"}
        aria-live={zipStatus.stage === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        aria-busy={isBusy}
      >
        <div className={styles.zipStatusHeading}>
          {isBusy && <span className={styles.zipSpinner} aria-hidden="true" />}
          <strong>
            {
              {
                idle: "Ready to upload",
                selected: "ZIP selected",
                validating: "Validating ZIP",
                ready: "Ready to upload",
                uploading: "Upload in progress",
                success: "Import complete",
                error: "ZIP upload needs attention",
              }[zipStatus.stage]
            }
          </strong>
        </div>
        {zipStatus.filename && <p className={styles.zipFilename}>{zipStatus.filename}</p>}
        <p className={styles.zipMessage}>{zipStatus.message}</p>
        {isBusy && (
          <>
            <progress
              aria-label={
                zipStatus.stage === "validating"
                  ? "ZIP validation in progress"
                  : "Image upload in progress"
              }
            />
            <p className={styles.busyNotice}>Keep this page open until processing finishes.</p>
          </>
        )}
      </div>

      {(zipPreview || zipStatus.stage === "success") && zipPreview?.targets && (
        <div className={styles.previewSection}>
          <p className={styles.previewSummary}>
            {`Validated: ${zipPreview.fileCount} file${zipPreview.fileCount === 1 ? "" : "s"} · ${zipPreview.questionCount} question${zipPreview.questionCount === 1 ? "" : "s"}. Review before uploading:`}
          </p>
          <ul className={styles.targetsList}>
            {zipPreview.targets.map((target, index) => {
              const badgeText =
                zipStatus.stage === "success"
                  ? "Uploaded & linked"
                  : (target.status ||
                     (target.replaces || target.replacesExisting
                       ? "Already linked · will replace image"
                       : "New image · ready to upload"));
              return (
                <li key={`${target.questionId}-${target.target}-${target.option || ""}-${index}`}>
                  <code>{target.questionId}</code> ·{" "}
                  {target.target === "option"
                    ? `option ${target.option} (${target.language || "en"})`
                    : `${target.target} (all languages)`}
                  {" ← "}{target.file}
                  <span className={styles.targetStatusBadge}>{badgeText}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default QuestionBankZipUpload;
