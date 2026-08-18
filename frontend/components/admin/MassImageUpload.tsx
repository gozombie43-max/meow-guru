"use client";
import { useRef, useState } from "react";
import { fetchWithRetry } from "@/lib/api/http";
import styles from "./AdminTool.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type Props = {
  subjectId: string;
  topicId: string;
  quizId: string;
  subjectName: string;
  topicName: string;
  quizName: string;
};

type UploadResult = {
  filename: string;
  questionId: string;
  questionImage?: string;
  error?: string;
};

type UploadResponse = {
  success: boolean;
  uploaded: number;
  failed: number;
  results: UploadResult[];
  errors: UploadResult[];
};

export default function MassImageUpload({}: Props) {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"auto" | "metadata">("auto");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipFile(file);
    setResponse(null);
    setError("");
  };

  const handleClear = () => {
    setZipFile(null);
    setResponse(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!zipFile) {
      setError("Please select a ZIP file first.");
      return;
    }

    setUploading(true);
    setError("");
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("zipFile", zipFile);

      const res = await fetchWithRetry(`${API}/api/mass-upload-question-images`, {
        method: "POST",
        body: formData,
      }, {
        attempts: 2,
        timeoutMs: 180000,
        retryDelayMs: 3000,
        retryMethods: ["POST"],
        retryOnStatuses: [502, 503, 504],
      });

      const data: UploadResponse = await res.json();

      if (!res.ok && !data.results) {
        throw new Error((data as unknown as { error: string }).error || `Server error ${res.status}`);
      }

      setResponse(data);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(
        /abort|timed out|signal is aborted/i.test(message)
          ? "Upload timed out before the server finished processing the ZIP archive."
          : message
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className={styles.macGroup}>
      <div className={styles.macGroupHeader}>
        <div>
          <h2 className={styles.macGroupTitle}>🖼️ Question Image ZIP Archive</h2>
          <span style={{ fontSize: 12, color: "#6e6e73" }}>
            Patches question illustration images directly into MCQ records by target ID
          </span>
        </div>
        {zipFile && (
          <button onClick={handleClear} className={styles.btnSecondary} style={{ padding: "3px 8px", fontSize: 11 }}>
            Clear
          </button>
        )}
      </div>

      {/* Mode selection */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[
          { value: "auto", label: "Auto (filename = questionId)", desc: "e.g. visual_123.png patches question ID visual_123" },
          { value: "metadata", label: "Metadata JSON", desc: "ZIP contains metadata.json with [{filename, questionId}]" },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMode(opt.value as "auto" | "metadata")}
            title={opt.desc}
            className={mode === opt.value ? styles.btnPrimary : styles.btnSecondary}
            style={{ fontSize: 12, padding: "5px 12px" }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: "#6e6e73", marginBottom: 12, padding: "8px 12px", background: "#fbfbfd", borderRadius: 7, border: "1px solid rgba(0, 0, 0, 0.06)" }}>
        {mode === "auto"
          ? "💡 Name your images after question IDs: e.g. visual_1776252864088_9d03bca4.png (stem becomes target ID)."
          : "💡 Include a metadata.json in the ZIP root: [{\"filename\": \"q1.png\", \"questionId\": \"visual_abc123\"}]"}
      </div>

      {/* Dropzone & Upload Button */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className={styles.macInput}
          style={{ flex: 1, minWidth: 200, padding: "6px 10px" }}
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !zipFile}
          className={styles.btnPrimary}
        >
          {uploading ? "Extracting & Uploading…" : "Upload Question Images →"}
        </button>
      </div>

      {zipFile && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "#6e6e73" }}>
          Selected: <span style={{ color: "#1d1d1f", fontWeight: 600 }}>{zipFile.name}</span>
          {" · "}{(zipFile.size / 1024).toFixed(1)} KB
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 12.5 }}>
          {error}
        </div>
      )}

      {/* Response Results */}
      {response && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: response.success ? "#dcfce7" : "#fee2e2",
            border: `1px solid ${response.success ? "#bbf7d0" : "#fecaca"}`,
            color: response.success ? "#15803d" : "#dc2626",
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            {response.success
              ? `✓ ${response.uploaded} question image${response.uploaded !== 1 ? "s" : ""} uploaded and linked`
              : "Upload failed"}
            {response.failed > 0 && (
              <span style={{ color: "#a16207", marginLeft: 10, fontWeight: 400 }}>
                · {response.failed} failed
              </span>
            )}
          </div>

          {response.results.length > 0 && (
            <div style={{ maxHeight: 150, overflowY: "auto", background: "#fbfbfd", borderRadius: 8, border: "1px solid rgba(0, 0, 0, 0.06)", padding: 6 }}>
              {response.results.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", fontSize: 12, borderBottom: "1px solid #f2f2f7" }}>
                  <span style={{ color: "#15803d", fontWeight: 600 }}>✓</span>
                  <span style={{ color: "#0071e3", fontFamily: "SF Mono, monospace", fontSize: 11 }}>{r.questionId}</span>
                  <span style={{ color: "#86868b" }}>←</span>
                  <span style={{ color: "#1d1d1f" }}>{r.filename}</span>
                  {r.questionImage && (
                    <a href={r.questionImage} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "#0071e3", fontSize: 11, textDecoration: "none" }}>
                      Preview ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
