"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Download,
  FileText,
  FolderOpen,
  Globe2,
  Plus,
  Search,
  Shapes,
  X,
} from "lucide-react";
import { fetchWithRetry } from "@/lib/api/http";

const resourceTabs = ["Books", "Chapter Wise", "Extra", "DPP"] as const;

const subjects = [
  {
    id: "math",
    label: "Math",
    shortLabel: "Math",
    Icon: Calculator,
    accent: "#2563eb",
    tint: "#e8f0ff",
  },
  {
    id: "reasoning",
    label: "Reasoning",
    shortLabel: "Reasoning",
    Icon: Shapes,
    accent: "#c026d3",
    tint: "#fae8ff",
  },
  {
    id: "english",
    label: "English",
    shortLabel: "English",
    Icon: BookOpen,
    accent: "#16a34a",
    tint: "#e8f7ee",
  },
  {
    id: "gk",
    label: "GK",
    shortLabel: "GK",
    Icon: Globe2,
    accent: "#d97706",
    tint: "#fff4df",
  },
] as const;

type SubjectId = (typeof subjects)[number]["id"];
type ResourceTab = (typeof resourceTabs)[number];

type ResourceFile = {
  id: string;
  title?: string;
  fileName?: string;
  topic: string;
  category?: string;
  streamUrl: string;
};

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function getCategory(tab: ResourceTab) {
  if (tab === "Books") return "notes";
  if (tab === "Chapter Wise") return "formula";
  return tab.toLowerCase();
}

function sortFiles(files: ResourceFile[]) {
  return [...files].sort((a, b) =>
    nameCollator.compare(a.title || a.fileName || "", b.title || b.fileName || "")
  );
}

export default function ResourcePage() {
  const API = process.env.NEXT_PUBLIC_API_URL || "";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ subject: SubjectId; tab: ResourceTab } | null>(null);
  const [activeSubject, setActiveSubject] = useState<SubjectId>("math");
  const [activeTab, setActiveTab] = useState<ResourceTab>("Books");
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const selectedSubject = subjects.find((subject) => subject.id === activeSubject) || subjects[0];
  const activeCategory = getCategory(activeTab);
  const apiUrl = useCallback((path: string) => (API ? `${API}${path}` : path), [API]);

  useEffect(() => {
    let cancelled = false;

    const loadFiles = async () => {
      setLoading(true);
      setNotice("");

      try {
        const params = new URLSearchParams({
          topic: activeSubject,
          category: activeCategory,
        });
        const res = await fetchWithRetry(apiUrl(`/api/pdfs?${params.toString()}`));
        if (!res.ok) throw new Error(`Resource fetch failed: ${res.status}`);

        const data = (await res.json()) as { pdfs?: ResourceFile[] };
        if (!cancelled) setFiles(sortFiles(data.pdfs || []));
      } catch (err) {
        console.error("Failed to load resources", err);
        if (!cancelled) {
          setFiles([]);
          setNotice("Unable to load files.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, activeSubject, apiUrl]);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return files;

    return files.filter((file) => {
      const haystack = `${file.title || ""} ${file.fileName || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [files, query]);

  const openFile = async (file: ResourceFile) => {
    try {
      const res = await fetchWithRetry(apiUrl(file.streamUrl), {}, { retries: 1 });
      if (!res.ok) throw new Error("Unable to open file.");

      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Missing file URL.");

      if (navigator.userAgent.includes("MeowApp")) {
        window.location.href = data.url;
        return;
      }

      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to open resource", err);
      window.open(apiUrl(file.streamUrl), "_blank", "noopener,noreferrer");
    }
  };

  const beginUpload = useCallback((subject: SubjectId, tab: ResourceTab) => {
    uploadTargetRef.current = { subject, tab };
    setActiveSubject(subject);
    setActiveTab(tab);
    setShowUploadModal(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const uploadTarget = uploadTargetRef.current;
    const uploadSubject = uploadTarget?.subject || activeSubject;
    const uploadTab = uploadTarget?.tab || activeTab;
    const uploadCategory = getCategory(uploadTab);
    const uploadSubjectLabel =
      subjects.find((subject) => subject.id === uploadSubject)?.label || selectedSubject.label;

    const invalidFile = selectedFiles.find((file) => {
      const name = file.name.toLowerCase();
      return (
        !name.endsWith(".pdf") &&
        !name.endsWith(".html") &&
        !name.endsWith(".htm") &&
        !name.endsWith(".doc") &&
        !name.endsWith(".docx")
      );
    });

    if (invalidFile) {
      setNotice("Select PDF, HTML, DOC, or DOCX files only.");
      uploadTargetRef.current = null;
      return;
    }

    const formData = new FormData();
    formData.append("topic", uploadSubject);
    formData.append("category", uploadCategory);
    selectedFiles.forEach((file) => formData.append("files", file));

    setUploading(true);
    setNotice("");

    try {
      const res = await fetch(apiUrl("/api/pdfs"), { method: "POST", body: formData });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Upload failed: ${res.status}`);
      }

      const data = (await res.json()) as { pdf?: ResourceFile; pdfs?: ResourceFile[] };
      const uploadedFiles = data.pdfs || (data.pdf ? [data.pdf] : []);
      setFiles((current) => sortFiles([...current, ...uploadedFiles]));
      setNotice(
        `${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} uploaded to ${uploadSubjectLabel} ${uploadTab}.`
      );
    } catch (err) {
      console.error("Failed to upload resources", err);
      setNotice(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      uploadTargetRef.current = null;
      setUploading(false);
    }
  };

  return (
    <main className="resource-page">
      <div className="resource-shell">
        <header className="resource-header">
          <Link href="/" className="back-link" aria-label="Back to home">
            <ArrowLeft size={20} strokeWidth={2.4} />
          </Link>
          <div className="header-copy">
            <p className="eyebrow">Resources</p>
            <h1>All Books &amp; Notes</h1>
          </div>
          <div className="search-row header-search">
            <span className="search-icon" aria-hidden="true">
              <Search size={17} />
            </span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              suppressHydrationWarning
            />
            {query ? (
              <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="Clear search">
                <X size={15} />
              </button>
            ) : null}
          </div>
        </header>

        <section className="subject-strip" aria-label="Subjects">
          {subjects.map((subject) => {
            const Icon = subject.Icon;
            const isActive = subject.id === activeSubject;

            return (
              <button
                key={subject.id}
                type="button"
                className={`subject-chip${isActive ? " is-active" : ""}`}
                style={{
                  "--subject-accent": subject.accent,
                  "--subject-tint": subject.tint,
                } as React.CSSProperties}
                onClick={() => setActiveSubject(subject.id)}
                aria-pressed={isActive}
              >
                <span className="subject-icon">
                  <Icon size={17} strokeWidth={2.35} />
                </span>
                <span>{subject.shortLabel}</span>
              </button>
            );
          })}
        </section>

        <section className="resource-panel">
          <div className="panel-top">
            <div>
              <p className="panel-kicker">{selectedSubject.label}</p>
              <h2>{activeTab}</h2>
            </div>
            <span className="count-pill">{visibleFiles.length}</span>
          </div>

          <div className="tab-row" role="tablist" aria-label="Resource categories">
            {resourceTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`tab-pill${tab === activeTab ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={tab === activeTab}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="file-list" aria-live="polite">
            {loading ? (
              <div className="state-box">Loading files...</div>
            ) : visibleFiles.length > 0 ? (
              visibleFiles.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  className="file-card"
                  style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
                  onClick={() => openFile(file)}
                >
                  <span className="file-icon">
                    <FileText size={20} strokeWidth={2.2} />
                  </span>
                  <span className="file-copy">
                    <span className="file-title">{file.title || file.fileName || "Untitled file"}</span>
                  </span>
                  <span className="file-action" aria-hidden="true">
                    <Download size={18} strokeWidth={2.35} />
                  </span>
                </button>
              ))
            ) : (
              <div className="state-box empty">
                <FolderOpen size={28} strokeWidth={1.9} />
                <span>No files found.</span>
              </div>
            )}
          </div>

          {notice ? <p className="notice">{notice}</p> : null}
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,text/html,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.html,.htm,.doc,.docx"
        multiple
        className="file-input"
        onChange={handleUpload}
        suppressHydrationWarning
      />

      <button
        type="button"
        className="fab"
        onClick={() => setShowUploadModal(true)}
        disabled={uploading}
        aria-label="Choose upload destination"
      >
        <Plus size={25} strokeWidth={2.4} />
      </button>

      {showUploadModal ? (
        <div className="upload-modal-backdrop" role="presentation" onClick={() => setShowUploadModal(false)}>
          <section
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-destination-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="upload-modal-header">
              <div>
                <p className="eyebrow">Add files</p>
                <h2 id="upload-destination-title">Where to add?</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowUploadModal(false)}
                aria-label="Close upload destination"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="upload-option-list">
              {subjects.flatMap((subject) =>
                resourceTabs.map((tab) => {
                  const Icon = subject.Icon;
                  return (
                    <button
                      key={`${subject.id}-${tab}`}
                      type="button"
                      className="upload-option"
                      style={{
                        "--subject-accent": subject.accent,
                        "--subject-tint": subject.tint,
                      } as React.CSSProperties}
                      onClick={() => beginUpload(subject.id, tab)}
                    >
                      <span className="upload-option-icon">
                        <Icon size={17} strokeWidth={2.35} />
                      </span>
                      <span className="upload-option-text">
                        <span>{subject.label} {tab}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      ) : null}

      <style jsx>{`
        .resource-page {
          height: 100dvh;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(245, 248, 255, 0.92)),
            radial-gradient(circle at 14% 12%, rgba(37, 99, 235, 0.16), transparent 28%),
            radial-gradient(circle at 88% 18%, rgba(22, 163, 74, 0.14), transparent 26%),
            radial-gradient(circle at 70% 92%, rgba(217, 119, 6, 0.16), transparent 30%);
          color: #111827;
          font-family: "General Sans", "Outfit", "Segoe UI", sans-serif;
          padding: max(18px, env(safe-area-inset-top)) 14px max(28px, env(safe-area-inset-bottom));
        }

        .resource-shell {
          width: min(760px, 100%);
          margin: 0 auto;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .resource-header {
          display: grid;
          grid-template-columns: 42px minmax(0, 1fr) minmax(220px, 320px);
          align-items: center;
          gap: 12px;
        }

        .back-link,
        .subject-chip,
        .tab-pill,
        .clear-search,
        .file-card,
        .fab {
          border: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .back-link {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.86);
          color: #111827;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
        }

        .header-copy {
          min-width: 0;
        }

        .eyebrow,
        .panel-kicker {
          margin: 0;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .header-copy h1 {
          margin: 2px 0 0;
          font-size: clamp(1.26rem, 4vw, 1.75rem);
          line-height: 1.05;
          font-weight: 800;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .fab:disabled {
          opacity: 0.68;
          cursor: wait;
        }

        .subject-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .subject-chip {
          min-width: 0;
          height: 70px;
          border-radius: 18px;
          padding: 9px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.74);
          color: #475569;
          font: inherit;
          font-size: 0.78rem;
          font-weight: 800;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06), 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        .subject-chip.is-active {
          color: var(--subject-accent);
          background: var(--subject-tint);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--subject-accent) 28%, transparent), 0 14px 28px rgba(15, 23, 42, 0.1);
        }

        .subject-icon {
          width: 30px;
          height: 30px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          color: currentColor;
        }

        .resource-panel {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.72);
          box-shadow: 0 24px 54px rgba(15, 23, 42, 0.12);
          padding: 16px;
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }

        .panel-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .panel-top h2 {
          margin: 2px 0 0;
          font-size: 1.2rem;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: 0;
        }

        .count-pill {
          min-width: 36px;
          height: 30px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          background: #eef2ff;
          color: #3730a3;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .tab-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 2px;
          scrollbar-width: none;
        }

        .tab-row::-webkit-scrollbar {
          display: none;
        }

        .tab-pill {
          height: 36px;
          flex: 0 0 auto;
          border-radius: 999px;
          padding: 0 15px;
          background: #f1f5f9;
          color: #64748b;
          font: inherit;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .tab-pill.is-active {
          background: #111827;
          color: #ffffff;
          box-shadow: 0 10px 20px rgba(17, 24, 39, 0.16);
        }

        .search-row {
          position: relative;
        }

        .header-search {
          min-width: 0;
          width: 100%;
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .search-row input {
          width: 100%;
          height: 46px;
          border: 0;
          outline: 0;
          border-radius: 16px;
          background: #f8fafc;
          color: #0f172a;
          padding: 0 44px 0 40px;
          font: inherit;
          font-size: 0.9rem;
          font-weight: 600;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
        }

        .search-row input:focus {
          box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.22);
        }

        .clear-search {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #e2e8f0;
          color: #475569;
        }

        .file-list {
          flex: 1;
          min-height: 220px;
          max-height: 100%;
          overflow-y: auto;
          overscroll-behavior: contain;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 2px 2px 74px;
          scrollbar-width: thin;
        }

        .file-card {
          width: 100%;
          min-height: 68px;
          border-radius: 18px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          background: #ffffff;
          color: #111827;
          font: inherit;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08), inset 0 0 0 1px rgba(15, 23, 42, 0.05);
          animation: fileIn 0.3s ease both;
        }

        .file-card:focus-visible,
        .subject-chip:focus-visible,
        .tab-pill:focus-visible,
        .fab:focus-visible,
        .back-link:focus-visible {
          outline: 2px solid rgba(37, 99, 235, 0.45);
          outline-offset: 3px;
        }

        .file-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          border-radius: 15px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          color: #2563eb;
        }

        .file-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .file-title {
          color: #111827;
          font-size: 0.93rem;
          line-height: 1.22;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .file-action {
          color: #94a3b8;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .state-box {
          min-height: 150px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #f8fafc;
          color: #64748b;
          font-size: 0.9rem;
          font-weight: 700;
          text-align: center;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
        }

        .state-box.empty {
          flex-direction: column;
        }

        .notice {
          margin: -4px 0 0;
          color: #475569;
          font-size: 0.78rem;
          font-weight: 700;
          text-align: center;
        }

        .file-input {
          display: none;
        }

        .fab {
          position: fixed;
          right: max(18px, env(safe-area-inset-right));
          bottom: max(18px, env(safe-area-inset-bottom));
          z-index: 10;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #111827;
          color: #ffffff;
          box-shadow: 0 18px 36px rgba(17, 24, 39, 0.28);
        }

        .upload-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 30;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.28);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .upload-modal {
          width: min(100%, 520px);
          max-height: min(78dvh, 640px);
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-radius: 24px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.78);
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.26);
        }

        .upload-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .upload-modal-header h2 {
          margin: 2px 0 0;
          color: #111827;
          font-size: 1.12rem;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: 0;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          color: #475569;
          cursor: pointer;
        }

        .upload-option-list {
          min-height: 0;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          padding: 1px 2px 2px;
          scrollbar-width: thin;
        }

        .upload-option {
          min-width: 0;
          min-height: 54px;
          border: 0;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: var(--subject-tint);
          color: var(--subject-accent);
          cursor: pointer;
          text-align: left;
          font: inherit;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--subject-accent) 20%, transparent);
        }

        .upload-option-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.86);
        }

        .upload-option-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          color: #0f172a;
          font-size: 0.84rem;
          line-height: 1.18;
          font-weight: 850;
          overflow-wrap: anywhere;
        }

        .modal-close:focus-visible,
        .upload-option:focus-visible {
          outline: 2px solid rgba(37, 99, 235, 0.45);
          outline-offset: 3px;
        }

        @keyframes fileIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 560px) {
          .resource-page {
            padding: max(14px, env(safe-area-inset-top)) 12px max(18px, env(safe-area-inset-bottom));
          }

          .resource-shell {
            min-height: 0;
          }

          .resource-header {
            grid-template-columns: 40px minmax(0, 1fr);
          }

          .header-search {
            grid-column: 1 / -1;
          }

          .header-search input {
            height: 44px;
          }

          .subject-strip {
            gap: 7px;
          }

          .subject-chip {
            height: 66px;
            border-radius: 16px;
            font-size: 0.73rem;
          }

          .resource-panel {
            border-radius: 22px;
            padding: 14px;
          }

          .file-title {
            font-size: 0.88rem;
            overflow-wrap: normal;
            word-break: normal;
          }

          .file-action {
            display: none;
          }

          .upload-modal-backdrop {
            padding: 12px;
          }

          .upload-modal {
            max-height: min(82dvh, 640px);
            border-radius: 22px;
            padding: 16px;
          }

          .upload-option-list {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
