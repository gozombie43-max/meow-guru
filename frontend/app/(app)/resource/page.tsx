"use client";

import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import { announceFeedback } from "@/lib/feedback";
import {
BookOpen,
Calculator,
ChevronLeft,
ChevronRight,
FileText,
Globe2,
Plus,
Search,
Shapes,
X,
} from "lucide-react";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

const resourceTabs = ["Books", "Chapter Wise", "Extra", "DPP"] as const;

const subjects = [
  {
    id: "math",
    label: "Math",
    shortLabel: "Math",
    Icon: Calculator,
    accent: "#007aff",
  },
  {
    id: "reasoning",
    label: "Reasoning",
    shortLabel: "Reasoning",
    Icon: Shapes,
    accent: "#af52de",
  },
  {
    id: "english",
    label: "English",
    shortLabel: "English",
    Icon: BookOpen,
    accent: "#34c759",
  },
  {
    id: "gk",
    label: "GK",
    shortLabel: "GK",
    Icon: Globe2,
    accent: "#ff9500",
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
  size?: number;
  updatedAt?: string;
  uploadedAt?: string;
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

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

function formatSize(size?: number, fileName?: string) {
  const lowerName = fileName?.toLowerCase() || "";
  const fallbackType = lowerName.endsWith(".html")
    ? "HTML"
    : lowerName.endsWith(".doc") || lowerName.endsWith(".docx")
      ? "DOC"
      : "PDF";
  if (!size) return fallbackType;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const PdfIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="30"
    height="30"
    className="res-pdf-icon"
    style={{ filter: "drop-shadow(0 2px 4px rgba(173, 11, 0, 0.25))" }}
  >
    <path
      fill="#AD0B00"
      d="M 12.5 4 C 10.019 4 8 6.019 8 8.5 L 8 39.5 C 8 41.981 10.019 44 12.5 44 L 35.5 44 C 37.981 44 40 41.981 40 39.5 L 40 20 L 28.5 20 C 26.019 20 24 17.981 24 15.5 L 24 4 L 12.5 4 z M 27 4.8789062 L 27 15.5 C 27 16.327 27.673 17 28.5 17 L 39.121094 17 L 27 4.8789062 z"
    />
    <path
      fill="#ffffff"
      d="M 22.5 21 C 23.878 21 25 22.121 25 23.5 C 25 25.306 24.701422 27.117172 24.232422 28.826172 C 24.656422 29.400172 25.126953 29.950125 25.626953 30.453125 C 27.148953 30.169125 28.785 30 30.5 30 C 31.878 30 33 31.121 33 32.5 C 33 33.879 31.878 35 30.5 35 C 28.574 35 26.664719 34.043094 25.011719 32.621094 C 24.134719 32.821094 23.310828 33.059359 22.548828 33.318359 C 21.359828 35.804359 20.013406 37.669891 19.191406 38.337891 C 18.650406 38.777891 18.082 39 17.5 39 C 16.833 39 16.205422 38.739578 15.732422 38.267578 C 15.259422 37.795578 15 37.168 15 36.5 C 15 35.81 15.276812 35.156031 15.757812 34.707031 C 16.714813 33.813031 18.580312 32.662656 21.070312 31.722656 C 21.421312 30.933656 21.755969 30.081547 22.042969 29.185547 C 20.779969 27.232547 20 25.137 20 23.5 C 20 22.121 21.122 21 22.5 21 z M 22.5 23 C 22.224 23 22 23.225 22 23.5 C 22 24.315 22.274047 25.306891 22.748047 26.337891 C 22.908047 25.407891 23 24.457 23 23.5 C 23 23.225 22.776 23 22.5 23 z M 30.5 32 C 29.557 32 28.643578 32.054344 27.767578 32.152344 C 28.665578 32.682344 29.596 33 30.5 33 C 30.776 33 31 32.775 31 32.5 C 31 32.225 30.776 32 30.5 32 z M 19.59375 34.558594 C 18.43575 35.151594 17.587094 35.735922 17.121094 36.169922 C 17.011094 36.273922 17 36.436 17 36.5 C 17 36.577 17.019484 36.725516 17.146484 36.853516 C 17.273484 36.981516 17.423 37 17.5 37 C 17.606 37 17.759687 36.924156 17.929688 36.785156 L 17.929688 36.783203 C 18.258688 36.515203 18.88875 35.721594 19.59375 34.558594 z"
    />
  </svg>
);

const IosSpinner = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className="ios-spinner"
    role="status"
    aria-label="Loading"
    style={{
      display: "block",
      margin: "0 auto",
      color: "var(--spinner-color, #8E8E93)",
    }}
  >
    <style>{`
      @keyframes ios-spinner-fade {
        0% { opacity: 1; }
        100% { opacity: 0.15; }
      }
    `}</style>
    {Array.from({ length: 12 }).map((_, i) => (
      <line
        key={i}
        x1="12"
        y1="2.4"
        x2="12"
        y2="6.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        transform={`rotate(${i * 30} 12 12)`}
        style={{
          animation: "ios-spinner-fade 0.9s linear infinite",
          animationDelay: `${-0.9 + (i * 0.9) / 12}s`,
        }}
      />
    ))}
  </svg>
);

export default function ResourcePage() {
  const API = API_BASE;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ subject: SubjectId; tab: ResourceTab } | null>(null);

  const [activeSubject, setActiveSubject] = useState<SubjectId>("math");
  const [activeTab, setActiveTab] = useState<ResourceTab>("Books");
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === activeSubject) || subjects[0];
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

  const triggerUploadCurrent = () => {
    uploadTargetRef.current = { subject: activeSubject, tab: activeTab };
    fileInputRef.current?.click();
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
      const message = "Select PDF, HTML, DOC, or DOCX files only.";
      setNotice(message);
      announceFeedback(message, "error");
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
      const message = err instanceof Error ? err.message : "File upload failed.";
      setNotice(message);
      announceFeedback(message, "error");
    } finally {
      uploadTargetRef.current = null;
      setUploading(false);
    }
  };

  return (
    <main className="resource-page">
      {/* ── Fixed Position Top Area ── */}
      <div className="res-top-pinned">
        <header className="res-header">
          {/* ── Compact Navigation Bar (44px) ── */}
          <div className="res-nav-bar">
            <Link href="/" className="res-nav-btn res-back-btn" aria-label="Back to home">
              <ChevronLeft size={22} strokeWidth={2.4} />
            </Link>

            <h1 className="res-nav-title">Resources</h1>

            <div className="res-nav-actions">
              <button
                type="button"
                className={`res-nav-btn ${showSearch ? "active" : ""}`}
                onClick={() => {
                  setShowSearch((prev) => !prev);
                  if (showSearch) setQuery("");
                }}
                aria-label="Search files"
              >
                <Search size={18} strokeWidth={2.2} />
              </button>

              {files.length === 0 && (
                <button
                  type="button"
                  className="res-nav-btn res-add-btn"
                  onClick={triggerUploadCurrent}
                  disabled={uploading}
                  aria-label="Add files"
                >
                  <Plus size={20} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>

          {/* ── Compact Search Bar Dropdown ── */}
          {showSearch && (
            <div className="res-search-container">
              <div className="res-search-input-wrap">
                <Search size={15} className="res-search-field-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${selectedSubject.label} ${activeTab}...`}
                  autoFocus
                  className="res-search-input"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="res-search-clear-btn"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Unified Filter Architecture ── */}
          <div className="res-filter-container">
            {/* Level 1: Primary Subject Segmented Control (iOS UISegmentedControl style) */}
            <div className="res-subject-segment" role="tablist" aria-label="Subjects">
              {subjects.map((subject) => {
                const Icon = subject.Icon;
                const isActive = subject.id === activeSubject;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    className={`res-segment-btn ${isActive ? "active" : ""}`}
                    style={{
                      "--subject-accent": subject.accent,
                    } as React.CSSProperties}
                    onClick={() => setActiveSubject(subject.id)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <Icon size={14} strokeWidth={2.2} className="res-segment-icon" />
                    <span className="res-segment-label">{subject.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Level 2: Secondary Category Chip Bar */}
            <div className="res-category-strip" role="tablist" aria-label="Resource Categories">
              {resourceTabs.map((tab) => {
                const isActive = tab === activeTab;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`res-chip ${isActive ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
        </header>
      </div>

      {/* ── Scrollable Document List ── */}
      <div className="res-scroll-body">
        <div className="res-content">
          {notice && (
            <div className="res-notice-banner">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                className="res-notice-close"
                aria-label="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {loading ? (
            <div className="res-loading-state" role="status" aria-label="Loading resources">
              <IosSpinner size={34} />
              <span className="res-loading-text">Loading {selectedSubject.label} files...</span>
            </div>
          ) : visibleFiles.length > 0 ? (
            <div className="res-card-list">
              {visibleFiles.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  className="res-card"
                  style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                  onClick={() => openFile(file)}
                >
                  <div className="res-card-icon-wrap" aria-hidden="true">
                    <PdfIcon />
                  </div>

                  <div className="res-card-body">
                    <span className="res-card-title">
                      {file.title || file.fileName || `${selectedSubject.label} Document`}
                    </span>
                    <div className="res-card-meta">
                      <span className="res-card-tag">{formatSize(file.size, file.fileName)}</span>
                      {file.updatedAt || file.uploadedAt ? (
                        <span className="res-card-date">
                          {formatDate(file.updatedAt || file.uploadedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="res-card-arrow" aria-hidden="true">
                    <ChevronRight size={18} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="res-empty-state">
              <div className="res-empty-icon" aria-hidden="true">
                <FileText size={34} strokeWidth={1.5} />
              </div>
              <p className="res-empty-title">
                {query ? "No matching files" : "No files found"}
              </p>
              <p className="res-empty-sub">
                {query
                  ? `No files match "${query}" in ${selectedSubject.label} ${activeTab}.`
                  : `No documents uploaded yet for ${selectedSubject.label} (${activeTab}).`}
              </p>
              {!query && (
                <button
                  type="button"
                  className="res-empty-btn"
                  onClick={triggerUploadCurrent}
                  disabled={uploading}
                >
                  <Plus size={16} strokeWidth={2.4} />
                  <span>Add {selectedSubject.label} {activeTab}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating Action Button (Only when documents exist) ── */}
      {files.length > 0 && (
        <button
          type="button"
          className="res-fab"
          onClick={() => setShowUploadModal(true)}
          disabled={uploading}
          aria-label="Add files"
        >
          <Plus size={24} strokeWidth={2.4} />
        </button>
      )}

      {/* ── Upload File Input (Hidden) ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,text/html,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.html,.htm,.doc,.docx"
        multiple
        className="res-file-input"
        onChange={handleUpload}
      />

      {/* ── Upload Destination Modal ── */}
      {showUploadModal && (
        <div
          className="res-modal-backdrop"
          role="presentation"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="res-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="res-upload-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="res-modal-header">
              <div>
                <p className="res-modal-eyebrow">Upload Document</p>
                <h2 id="res-upload-title" className="res-modal-title">Where to add?</h2>
              </div>
              <button
                type="button"
                className="res-modal-close"
                onClick={() => setShowUploadModal(false)}
                aria-label="Close modal"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            <div className="res-modal-options">
              {subjects.flatMap((subject) =>
                resourceTabs.map((tab) => {
                  const Icon = subject.Icon;
                  const isCurrent = subject.id === activeSubject && tab === activeTab;
                  return (
                    <button
                      key={`${subject.id}-${tab}`}
                      type="button"
                      className={`res-modal-option ${isCurrent ? "current" : ""}`}
                      style={{
                        "--subject-accent": subject.accent,
                      } as React.CSSProperties}
                      onClick={() => beginUpload(subject.id, tab)}
                    >
                      <span className="res-modal-option-icon">
                        <Icon size={16} strokeWidth={2.3} />
                      </span>
                      <span className="res-modal-option-label">
                        <strong>{subject.label}</strong> {tab}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <button
              type="button"
              className="res-modal-cancel"
              onClick={() => setShowUploadModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ════════════════════════════════════════════
           THEME TOKENS: DARK (DEFAULT)
           ════════════════════════════════════════════ */
        .resource-page {
          --bg: #000000;
          --card-bg: #1c1c1e;
          --card-hover: #242428;
          --border: rgba(255, 255, 255, 0.09);
          --header-bg: rgba(0, 0, 0, 0.92);
          --text-primary: #f8fafc;
          --text-secondary: rgba(235, 235, 245, 0.6);
          --text-tertiary: rgba(235, 235, 245, 0.35);
          --tab-bg: rgba(255, 255, 255, 0.08);
          --tab-color: rgba(235, 235, 245, 0.75);
          --accent: #007aff;
          --modal-bg: #1c1c1e;
          --modal-option-bg: #28282c;
          --notice-bg: rgba(255, 255, 255, 0.08);
          --spinner-color: rgba(235, 235, 245, 0.75);

          height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }

        /* ── Fixed Position Top Area ── */
        .res-top-pinned {
          flex-shrink: 0;
          z-index: 30;
          background: var(--header-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding-top: var(--safe-top);
        }

        .res-nav-bar {
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          max-width: 600px;
          margin: 0 auto;
        }

        .res-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          text-decoration: none;
        }

        .res-nav-btn:hover {
          background: var(--tab-bg);
        }

        .res-nav-btn:active {
          opacity: 0.6;
          transform: scale(0.95);
        }

        .res-nav-btn.active {
          background: var(--accent);
          color: #ffffff;
        }

        .res-nav-title {
          font-size: 17px;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          padding: 0 8px;
        }

        .res-nav-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── Search Bar Dropdown ── */
        .res-search-container {
          padding: 0 12px 6px;
          max-width: 600px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          animation: res-slide-down 0.2s ease;
        }

        @keyframes res-slide-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .res-search-input-wrap {
          position: relative;
          width: 100%;
          display: block;
        }

        .res-search-input {
          width: 100%;
          height: 34px;
          border-radius: 9px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          font-size: 13.5px;
          padding: 0 32px 0 32px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s ease;
          font-family: inherit;
        }

        .res-search-input:focus {
          border-color: var(--accent);
        }

        :global(.res-search-field-icon) {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .res-search-clear-btn {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--tab-bg);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }

        /* ── Unified Filter Architecture ── */
        .res-filter-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 0 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Level 1: Primary Subject Segmented Control (iOS UISegmentedControl) */
        .res-subject-segment {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: var(--segment-track, rgba(120, 120, 128, 0.18));
          border-radius: 9px;
          padding: 2.5px;
          box-sizing: border-box;
          height: 33px;
          align-items: center;
        }

        .res-segment-btn {
          height: 28px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 550;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
          padding: 0 4px;
          font-family: inherit;
        }

        .res-segment-btn:hover {
          color: var(--text-primary);
        }

        .res-segment-btn.active {
          background: var(--segment-active-bg, #3a3a3c);
          color: #ffffff;
          font-weight: 650;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(0, 0, 0, 0.12);
        }

        :global(.res-segment-icon) {
          color: currentColor;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .res-segment-btn.active :global(.res-segment-icon) {
          color: var(--subject-accent, var(--accent));
        }

        .res-segment-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Level 2: Secondary Category Chip Bar */
        .res-category-strip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          padding: 0 2px;
        }

        .res-category-strip::-webkit-scrollbar {
          display: none;
        }

        .res-chip {
          height: 25px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--tab-color);
          font-size: 11.5px;
          font-weight: 550;
          letter-spacing: 0.01em;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.14s ease;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
        }

        .res-chip:hover {
          color: var(--text-primary);
          background: var(--card-hover);
        }

        .res-chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 1.5px 6px rgba(0, 122, 255, 0.35);
        }

        /* ── Scrollable Document List Area ── */
        .res-scroll-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          scrollbar-width: thin;
        }

        .res-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          padding: 14px 14px calc(92px + var(--safe-bottom));
          box-sizing: border-box;
        }

        /* ── Notice Banner ── */
        .res-notice-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 12px;
          background: var(--notice-bg);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 12px;
          animation: res-fade-up 0.2s ease;
        }

        .res-notice-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }

        /* ── Loading State ── */
        .res-loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(65dvh - 120px);
          gap: 14px;
          animation: res-fade-up 0.25s ease;
          margin: auto 0;
          text-align: center;
          width: 100%;
        }

        :global(.ios-spinner) {
          display: inline-block;
          color: var(--spinner-color);
          flex-shrink: 0;
        }

        .res-loading-text {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        /* ── Cards List ── */
        .res-card-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .res-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          min-height: 62px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          text-decoration: none;
          outline: none;
          transition: background-color 0.12s ease, border-color 0.12s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          animation: res-fade-up 0.28s ease both;
        }

        @keyframes res-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (hover: hover) {
          .res-card:hover {
            background: var(--card-hover);
            border-color: rgba(255, 255, 255, 0.16);
          }
        }

        .res-card:active {
          background: var(--card-hover);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .res-card-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .res-card-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .res-card-title {
          font-size: 14.5px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .res-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .res-card-tag {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--tab-bg);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .res-card-date {
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        .res-card-arrow {
          color: var(--text-tertiary);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
        }

        @media (hover: hover) {
          .res-card:hover .res-card-arrow {
            color: var(--text-primary);
          }
        }

        /* ── Empty State ── */
        .res-empty-state {
          text-align: center;
          padding: 56px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          animation: res-fade-up 0.28s ease;
        }

        .res-empty-icon {
          color: var(--text-tertiary);
          margin-bottom: 2px;
        }

        .res-empty-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .res-empty-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 280px;
          line-height: 1.4;
        }

        .res-empty-btn {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--accent);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.35);
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .res-empty-btn:active {
          transform: scale(0.96);
          opacity: 0.85;
        }

        /* ── Floating Action Button (FAB) ── */
        .res-fab {
          position: fixed;
          bottom: calc(24px + var(--safe-bottom));
          right: max(20px, env(safe-area-inset-right));
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: #ffffff;
          box-shadow: 0 4px 18px rgba(0, 122, 255, 0.44), 0 2px 6px rgba(0, 122, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 35;
          transition: transform 0.16s ease, box-shadow 0.16s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .res-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 22px rgba(0, 122, 255, 0.55);
        }

        .res-fab:active {
          transform: scale(0.92);
        }

        .res-fab:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .res-file-input {
          display: none;
        }

        /* ── Upload Modal ── */
        .res-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: res-fade-in 0.18s ease;
        }

        @keyframes res-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .res-modal {
          width: min(100%, 420px);
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--modal-bg);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          padding: 20px;
          margin-bottom: var(--safe-bottom);
          animation: res-modal-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes res-modal-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .res-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .res-modal-eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }

        .res-modal-title {
          margin: 2px 0 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .res-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--tab-bg);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .res-modal-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          max-height: 52dvh;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 1px;
        }

        .res-modal-option {
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid var(--border);
          color: var(--text-primary);
          background: var(--modal-option-bg);
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          text-align: left;
          transition: background 0.15s ease, border-color 0.15s ease;
          font-family: inherit;
        }

        .res-modal-option:hover {
          background: var(--card-hover);
        }

        .res-modal-option.current {
          border-color: var(--subject-accent, var(--accent));
          box-shadow: inset 0 0 0 1px var(--subject-accent, var(--accent));
        }

        .res-modal-option-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--subject-accent, var(--accent));
          flex-shrink: 0;
        }

        .res-modal-option-label strong {
          color: var(--text-primary);
          font-weight: 650;
        }

        .res-modal-cancel {
          width: 100%;
          min-height: 44px;
          margin-top: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .res-modal-cancel:hover {
          background: var(--tab-bg);
        }

        /* ════════════════════════════════════════════
           LIGHT THEME OVERRIDES
           ════════════════════════════════════════════ */
        :global(body.theme-light) .resource-page,
        :global(html.theme-light) .resource-page {
          --bg: #f6f8fa;
          --card-bg: #ffffff;
          --card-hover: #f8fafc;
          --border: rgba(0, 0, 0, 0.08);
          --header-bg: rgba(246, 248, 250, 0.92);
          --text-primary: #1d1d1f;
          --text-secondary: #57606a;
          --text-tertiary: #8c959f;
          --tab-bg: rgba(0, 0, 0, 0.05);
          --tab-color: #57606a;
          --modal-bg: #ffffff;
          --modal-option-bg: #f2f2f7;
          --notice-bg: rgba(0, 0, 0, 0.04);
          --spinner-color: rgba(60, 60, 67, 0.6);
          --segment-track: rgba(118, 118, 128, 0.12);
          --segment-active-bg: #ffffff;
        }

        :global(body.theme-light) .res-segment-btn.active,
        :global(html.theme-light) .res-segment-btn.active {
          color: #000000;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
        }

        :global(body.theme-light) .res-card {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        @media (hover: hover) {
          :global(body.theme-light) .res-card:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            background: #f8fafc;
            border-color: rgba(0, 0, 0, 0.14);
          }
        }

        :global(body.theme-light) .res-card:active {
          background: #ebeef2;
          border-color: rgba(0, 0, 0, 0.16);
        }
      `}</style>
    </main>
  );
}
