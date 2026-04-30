"use client";
import { useState, useRef } from "react";
import { fetchWithRetry } from "@/lib/api/http";

const API = process.env.NEXT_PUBLIC_API_URL || "";

type UploadResult = {
  filename: string;
  questionId: string;
  solutionImage?: string;
  error?: string;
};

type UploadResponse = {
  success: boolean;
  uploaded: number;
  failed: number;
  results: UploadResult[];
  errors: UploadResult[];
};

export default function MassSolutionUpload() {
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

      const res = await fetchWithRetry(`${API}/api/mass-upload-solutions`, {
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
          ? "Upload timed out before the server finished processing the ZIP. Try again or use a smaller batch."
          : message
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      border: "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12,
      padding: "1rem",
      background: "var(--color-background-secondary)",
      marginTop: 12,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
            Mass Solution Upload
          </h3>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0", lineHeight: 1.5 }}>
            Upload a ZIP of solution images. Each image patches the matching question with a{" "}
            <code style={{ fontSize: 11, background: "var(--color-background-primary)", padding: "1px 5px", borderRadius: 4 }}>solutionImage</code> URL.
          </p>
        </div>
        {zipFile && (
          <button
            onClick={handleClear}
            style={{ padding: "4px 10px", borderRadius: 7, border: "0.5px solid var(--color-border-secondary)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[
          { value: "auto", label: "Auto (filename = questionId)", desc: "e.g. abc123.png → patches question abc123" },
          { value: "metadata", label: "Metadata JSON", desc: "ZIP contains metadata.json with [{filename, questionId}]" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value as "auto" | "metadata")}
            title={opt.desc}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: mode === opt.value
                ? "1px solid #6d28d9"
                : "0.5px solid var(--color-border-secondary)",
              background: mode === opt.value ? "#ede9fe" : "transparent",
              color: mode === opt.value ? "#5b21b6" : "var(--color-text-secondary)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: mode === opt.value ? 500 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Mode hint */}
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 10, padding: "6px 10px", background: "var(--color-background-primary)", borderRadius: 7, border: "0.5px solid var(--color-border-tertiary)" }}>
        {mode === "auto"
          ? "Name your images after question IDs: e.g. visual_1776252864088_9d03bca4.png — the filename stem is used as the questionId."
          : "Include a metadata.json in the ZIP root: [{\"filename\": \"q1.png\", \"questionId\": \"visual_abc123\"}]"}
      </div>

      {/* File picker + Upload button */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          style={{
            flex: 1,
            padding: "6px 10px",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: 8,
            fontSize: 12,
            background: "var(--color-background-primary)",
            color: "var(--color-text-primary)",
          }}
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !zipFile}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: uploading ? "#a855f7" : "#6d28d9",
            color: "#fff",
            cursor: uploading || !zipFile ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            opacity: !zipFile ? 0.5 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {uploading ? "Uploading..." : "Upload Solutions"}
        </button>
      </div>

      {/* Selected file info */}
      {zipFile && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-text-secondary)" }}>
          Selected: <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{zipFile.name}</span>
          {" · "}{(zipFile.size / 1024).toFixed(1)} KB
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Response summary */}
      {response && (
        <div style={{ marginTop: 12 }}>
          {/* Summary bar */}
          <div style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: response.success ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${response.success ? "#bbf7d0" : "#fecaca"}`,
            color: response.success ? "#16a34a" : "#dc2626",
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
          }}>
            {response.success
              ? `✓ ${response.uploaded} solution${response.uploaded !== 1 ? "s" : ""} uploaded successfully`
              : `Upload failed`}
            {response.failed > 0 && (
              <span style={{ color: "#d97706", marginLeft: 10, fontWeight: 400 }}>
                · {response.failed} failed
              </span>
            )}
          </div>

          {/* Success results */}
          {response.results.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 4 }}>Uploaded:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
                {response.results.map((r, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", borderRadius: 6,
                    background: "var(--color-background-primary)",
                    border: "0.5px solid var(--color-border-tertiary)",
                    fontSize: 12,
                  }}>
                    <span style={{ color: "#16a34a", fontWeight: 600 }}>✓</span>
                    <span style={{ color: "var(--color-text-secondary)", fontFamily: "monospace", fontSize: 11 }}>{r.questionId}</span>
                    <span style={{ color: "var(--color-text-secondary)" }}>←</span>
                    <span style={{ color: "var(--color-text-primary)" }}>{r.filename}</span>
                    {r.solutionImage && (
                      <a
                        href={r.solutionImage}
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginLeft: "auto", color: "#6d28d9", fontSize: 11, textDecoration: "none" }}
                      >
                        View ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {response.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 4 }}>Failed:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 120, overflowY: "auto" }}>
                {response.errors.map((e, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "5px 10px", borderRadius: 6,
                    background: "#fef2f2",
                    border: "0.5px solid #fecaca",
                    fontSize: 12,
                  }}>
                    <span style={{ color: "#dc2626", fontWeight: 600 }}>✗</span>
                    <span style={{ color: "var(--color-text-primary)" }}>{e.filename}</span>
                    <span style={{ color: "#dc2626", marginLeft: "auto" }}>{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
