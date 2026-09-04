"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Plus, Search, X } from "lucide-react";
import { fetchWithRetry } from "@/lib/api/http";

const tabs = ["Notes", "Formula", "Extra", "DPP"];
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const TOPIC_LABELS: Record<string, string> = {
  arithmetic: "Arithmetic",
  algebra: "Algebra",
  averages: "Averages",
  discount: "Discount",
  geometry: "Geometry",
  interest: "Interest",
  mensuration: "Mensuration",
  "mixture-and-alligation": "Mixture & Alligation",
  "number-system": "Number System",
  partnership: "Partnership",
  percentages: "Percentages",
  "profit-and-loss": "Profit & Loss",
  "ratio-and-proportion": "Ratio & Proportion",
  "square-roots": "Square Roots",
  "statistics-probability": "Statistics & Probability",
  "time-and-distance": "Time & Distance",
  "time-and-work": "Time & Work",
  trigonometry: "Trigonometry",
  "coding-decoding": "Coding & Decoding",
};

type TopicPdf = {
  id: string;
  title?: string;
  fileName?: string;
  topic: string;
  category?: string;
  size?: number;
  uploadedAt?: string;
  updatedAt?: string;
  streamUrl: string;
};

function getTopicLabel(topic: string) {
  return (
    TOPIC_LABELS[topic] ??
    topic
      .split("-")
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function sortByName(files: TopicPdf[]) {
  return [...files].sort((a, b) =>
    nameCollator.compare(a.title || a.fileName || "", b.title || b.fileName || "")
  );
}

const PdfIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    width="28"
    height="28"
    style={{ filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))" }}
  >
    <path fill="#ffadc8" d="M39,16v25c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h17L39,16z" />
    <path fill="#e72636" d="M28,5v9c0,1.105,0.895,2,2,2h9L28,5z" />
    <path fill="#e72636" d="M16.738,26.99v2.531h-1.655v-7.348h2.592c1.852,0,2.777,0.781,2.777,2.342 c0,0.738-0.265,1.335-0.797,1.791c-0.531,0.456-1.241,0.684-2.129,0.684H16.738z M16.738,23.445v2.29h0.651 c0.882,0,1.322-0.386,1.322-1.159c0-0.754-0.44-1.132-1.322-1.132L16.738,23.445L16.738,23.445z" />
    <path fill="#e72636" d="M21.528,29.521v-7.348h2.603c2.61,0,3.914,1.194,3.914,3.581c0,1.145-0.356,2.058-1.068,2.741 c-0.712,0.684-1.661,1.025-2.846,1.025h-2.603V29.521z M23.183,23.521v4.657h0.82c0.717,0,1.279-0.215,1.688-0.645 c0.408-0.43,0.612-1.016,0.612-1.758c0-0.7-0.202-1.251-0.606-1.652c-0.405-0.402-0.973-0.602-1.704-0.602H23.183z" />
    <path fill="#e72636" d="M33.514,23.521h-2.593v1.803h2.383v1.343h-2.383v2.854h-1.655v-7.348h4.248V23.521z" />
  </svg>
);

const IosSpinner = ({ size = 34 }: { size?: number }) => (
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
        y2="6.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        transform={`rotate(${i * 30} 12 12)`}
        style={{
          animation: "ios-spinner-fade 1.2s linear infinite",
          animationDelay: `${-1.2 + i * 0.1}s`,
        }}
      />
    ))}
  </svg>
);

export default function FormulaNotesPage({
  topic: topicProp,
  topicLabel: topicLabelProp,
  subject = "Mathematics",
}: {
  topic?: string;
  topicLabel?: string;
  subject?: string;
}) {
  const router = useRouter();
  const params = useParams();
  const routeTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const topic = topicProp || String(routeTopic || "");
  const topicLabel = topicLabelProp || getTopicLabel(topic);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef<Record<string, TopicPdf[]>>({});
  const [activeTab, setActiveTab] = useState("Notes");
  const [pdfs, setPdfs] = useState<TopicPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "";
  const apiUrl = useCallback((path: string) => (API ? `${API}${path}` : path), [API]);
  const categoryFromTab = useCallback((tab: string) => tab.toLowerCase(), []);

  const getCachedPdfs = useCallback(
    (cat: string): TopicPdf[] | null => {
      if (cacheRef.current[cat] !== undefined) return cacheRef.current[cat];
      if (typeof window !== "undefined") {
        try {
          const stored =
            localStorage.getItem(`fn_cache_${topic}_${cat}`) ||
            sessionStorage.getItem(`fn_cache_${topic}_${cat}`);
          if (stored) {
            const parsed = JSON.parse(stored) as TopicPdf[];
            if (Array.isArray(parsed)) {
              cacheRef.current[cat] = parsed;
              return parsed;
            }
          }
        } catch {
          // ignore storage read issues
        }
      }
      return null;
    },
    [topic]
  );

  const setCachedPdfs = useCallback(
    (cat: string, data: TopicPdf[]) => {
      cacheRef.current[cat] = data;
      if (typeof window !== "undefined") {
        try {
          const serialized = JSON.stringify(data);
          localStorage.setItem(`fn_cache_${topic}_${cat}`, serialized);
          sessionStorage.setItem(`fn_cache_${topic}_${cat}`, serialized);
        } catch {
          // ignore storage write issues
        }
      }
    },
    [topic]
  );

  const fetchCategoryPdfs = useCallback(
    async (tab: string, bypassCache = false) => {
      if (!topic) return;
      const category = categoryFromTab(tab);

      const cached = getCachedPdfs(category);
      if (cached !== null && !bypassCache) {
        setPdfs(cached);
        setLoading(false);
        setNotice("");
        // Quiet background revalidation (stale-while-revalidate)
        fetch(
          apiUrl(`/api/pdfs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`)
        )
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { pdfs?: TopicPdf[] } | null) => {
            if (d?.pdfs) {
              const sorted = sortByName(d.pdfs);
              setCachedPdfs(category, sorted);
              setPdfs(sorted);
            }
          })
          .catch(() => {});
        return;
      }

      setPdfs([]);
      setLoading(true);
      setNotice("");
      try {
        const res = await fetchWithRetry(
          apiUrl(`/api/pdfs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`),
          {},
          { timeoutMs: 8000, retries: 1 }
        );
        if (!res.ok) {
          if (res.status === 429) {
            const fallbackCached = getCachedPdfs(category);
            if (fallbackCached) {
              setPdfs(fallbackCached);
              setLoading(false);
              return;
            }
            setNotice("Server busy. Please wait a moment.");
            setLoading(false);
            return;
          }
          throw new Error(`PDF fetch failed: ${res.status}`);
        }
        const data = (await res.json()) as { pdfs?: TopicPdf[] };
        const sorted = sortByName(data.pdfs || []);
        setCachedPdfs(category, sorted);
        setPdfs(sorted);
      } catch (err) {
        console.warn("Could not load PDFs:", err);
        const fallbackCached = getCachedPdfs(category);
        if (fallbackCached) {
          setPdfs(fallbackCached);
        } else {
          setNotice("Unable to load PDFs.");
        }
      } finally {
        setLoading(false);
      }
    },
    [apiUrl, categoryFromTab, getCachedPdfs, setCachedPdfs, topic]
  );

  useEffect(() => {
    fetchCategoryPdfs(activeTab);
  }, [activeTab, fetchCategoryPdfs]);

  // Prefetch other categories quietly in background on mount
  useEffect(() => {
    if (!topic) return;
    const remainingTabs = tabs.filter((t) => t !== activeTab);
    remainingTabs.forEach((t) => {
      const cat = categoryFromTab(t);
      if (getCachedPdfs(cat) === null) {
        fetch(apiUrl(`/api/pdfs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(cat)}`))
          .then((r) => (r.ok ? r.json() : null))
          .then((d: { pdfs?: TopicPdf[] } | null) => {
            if (d?.pdfs) {
              setCachedPdfs(cat, sortByName(d.pdfs));
            }
          })
          .catch(() => {});
      }
    });
  }, [activeTab, apiUrl, categoryFromTab, getCachedPdfs, setCachedPdfs, tabs, topic]);

  const showSyncing = loading && pdfs.length === 0;

  const formatDate = (value?: string) => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  };

  const formatSize = (size?: number, fileName?: string) => {
    const lowerName = fileName?.toLowerCase() || "";
    const fallbackType = lowerName.endsWith(".html")
      ? "HTML"
      : lowerName.endsWith(".doc") || lowerName.endsWith(".docx")
        ? "DOC"
        : "PDF";
    if (!size) return fallbackType;
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openPdf = async (pdf: TopicPdf) => {
    try {
      const res = await fetch(apiUrl(pdf.streamUrl));
      const data = await res.json();
      const isMeowApp = navigator.userAgent.includes("MeowApp");
      if (isMeowApp) {
        window.location.href = data.url;
      } else {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(apiUrl(pdf.streamUrl), "_blank");
    }
  };

  const chooseUploadCategory = (category: string) => {
    setUploadCategory(category);
    setActiveTab(tabs.find((tab) => categoryFromTab(tab) === category) || "Notes");
    setShowAddModal(false);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || !topic) return;

    const invalidFile = files.find((file) => {
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
      return;
    }

    const formData = new FormData();
    formData.append("topic", topic);
    formData.append("category", uploadCategory);
    files.forEach((file) => formData.append("files", file));

    setUploading(true);
    setNotice("");

    try {
      const res = await fetchWithRetry(
        apiUrl("/api/pdfs"),
        { method: "POST", body: formData },
        { timeoutMs: 60000, retries: 0 }
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Upload failed: ${res.status}`);
      }

      const data = (await res.json()) as { pdf?: TopicPdf; pdfs?: TopicPdf[] };
      const uploadedFiles = data.pdfs || (data.pdf ? [data.pdf] : []);
      const visibleUploads = uploadedFiles.filter((pdf) => pdf.category === categoryFromTab(activeTab));
      if (visibleUploads.length) {
        setPdfs((current) => {
          const updated = sortByName([...current, ...visibleUploads]);
          setCachedPdfs(uploadCategory, updated);
          return updated;
        });
      } else {
        const cachedOther = getCachedPdfs(uploadCategory);
        if (cachedOther) {
          setCachedPdfs(uploadCategory, sortByName([...cachedOther, ...uploadedFiles]));
        }
      }
      setNotice(`${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} uploaded to ${uploadCategory.toUpperCase()}.`);
    } catch (err) {
      console.warn("Failed to upload files", err);
      setNotice(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const filteredPdfs = useMemo(() => {
    if (!searchQuery.trim()) return pdfs;
    const q = searchQuery.toLowerCase().trim();
    return pdfs.filter((pdf) =>
      (pdf.title || pdf.fileName || "").toLowerCase().includes(q)
    );
  }, [pdfs, searchQuery]);

  const subjectSlug = subject.toLowerCase().replace(/\s+/g, "-");
  const fallbackBackHref = `/${subjectSlug}/${topic}`;

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackBackHref);
    }
  };

  return (
    <main className="formula-notes-page">
      {/* ── Fixed Position Top Area: Header + Filter Box ── */}
      <div className="fn-top-pinned">
        <header className="fn-header">
          <div className="fn-header-inner">
            <button
              type="button"
              className="fn-back-btn"
              onClick={handleBack}
              aria-label="Back"
            >
              <ChevronLeft size={22} />
            </button>
            <h1 className="fn-header-title">{topicLabel}</h1>
            <div className="fn-header-actions">
              <button
                type="button"
                className={`fn-search-btn ${isSearchOpen ? "active" : ""}`}
                onClick={() => {
                  setIsSearchOpen((prev) => !prev);
                  if (isSearchOpen) setSearchQuery("");
                }}
                aria-label="Search files"
              >
                {isSearchOpen ? <X size={19} /> : <Search size={19} />}
              </button>
              <button
                type="button"
                className="fn-add-btn"
                onClick={() => setShowAddModal(true)}
                aria-label={`Add files to ${topicLabel}`}
                disabled={uploading}
              >
                <Plus size={21} />
              </button>
            </div>
          </div>

          {isSearchOpen ? (
            <div className="fn-search-bar">
              <div className="fn-search-input-wrap">
                <span className="fn-search-input-icon">
                  <Search size={15} />
                </span>
                <input
                  type="text"
                  className="fn-search-input"
                  placeholder={`Search in ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="fn-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>

        {/* ── Fixed Position Filter Box (Category Tabs) ── */}
        <div className="fn-filter-box">
          <div className="fn-tabs-wrapper">
            <div className="fn-tabs" role="tablist" aria-label="PDF categories">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`fn-tab-pill ${tab === activeTab ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(tab);
                    setSearchQuery("");
                  }}
                  role="tab"
                  aria-selected={tab === activeTab}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable PDF Cards Area Only ── */}
      <div className="fn-scroll-body">
        <div className="fn-content">
          {/* ── First-Time Documents Loading: iOS Spinner ── */}
          {loading && pdfs.length === 0 ? (
            <div className="fn-loading-state" role="status" aria-label="Loading documents">
              <IosSpinner size={34} />
              <p className="fn-loading-text">Loading documents...</p>
            </div>
          ) : notice ? (
            <div className="fn-error-state">
              <p className="fn-error-text">{notice}</p>
              <button
                type="button"
                className="fn-retry-btn"
                onClick={() => fetchCategoryPdfs(activeTab, true)}
              >
                Retry
              </button>
            </div>
          ) : (
            /* ── File Cards List ── */
            <section className="fn-card-list">
              {filteredPdfs.length > 0 ? (
                filteredPdfs.map((pdf, index) => (
                  <button
                    key={pdf.id}
                    onClick={() => openPdf(pdf)}
                    type="button"
                    className="fn-card"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="fn-card-icon-wrap" aria-hidden="true">
                      <PdfIcon />
                    </div>
                    <div className="fn-card-body">
                      <span className="fn-card-title">
                        {pdf.title || pdf.fileName || `${topicLabel} PDF`}
                      </span>
                      <div className="fn-card-meta">
                        <span className="fn-card-tag">{formatSize(pdf.size, pdf.fileName)}</span>
                        {pdf.updatedAt || pdf.uploadedAt ? (
                          <span className="fn-card-date">
                            {formatDate(pdf.updatedAt || pdf.uploadedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="fn-card-arrow" aria-hidden="true">
                      <ChevronRight size={18} />
                    </div>
                  </button>
                ))
              ) : !loading && !notice ? (
                <div className="fn-empty-state">
                  <div className="fn-empty-icon" aria-hidden="true">
                    <FileText size={32} strokeWidth={1.5} />
                  </div>
                  <p className="fn-empty-title">
                    {searchQuery ? "No matching files" : "No files found"}
                  </p>
                  <p className="fn-empty-sub">
                    {searchQuery
                      ? `No files match "${searchQuery}" in ${activeTab}.`
                      : `There are currently no files in the ${activeTab} category.`}
                  </p>
                  {!searchQuery ? (
                    <button
                      type="button"
                      className="fn-empty-add-btn"
                      onClick={() => chooseUploadCategory(categoryFromTab(activeTab))}
                      disabled={uploading}
                      aria-label={`Add files to ${activeTab}`}
                    >
                      <Plus size={16} strokeWidth={2.4} />
                      <span>Add {activeTab}</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>

      {/* ── Hidden File Upload Input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,text/html,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.html,.htm,.doc,.docx"
        multiple
        className="pdf-input"
        onChange={handlePdfUpload}
      />

      {/* ── Floating Action Button (FAB) ── */}
      <button
        className="fn-fab"
        type="button"
        aria-label={`Add files to ${topicLabel}`}
        disabled={uploading}
        onClick={() => setShowAddModal(true)}
      >
        <Plus size={24} />
      </button>

      {/* ── Category Choice Modal ── */}
      {showAddModal ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowAddModal(false)}>
          <div
            className="add-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-pdf-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="add-pdf-title">Add files to</h2>
            <div className="modal-options">
              {tabs.map((tab) => {
                const category = categoryFromTab(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    className="modal-option"
                    onClick={() => chooseUploadCategory(category)}
                  >
                    {tab.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <button type="button" className="modal-cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .bottom-pill-nav {
          display: none !important;
        }

        body.has-bottom-nav {
          padding-bottom: 0 !important;
        }

        @keyframes ios-spinner-fade {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0.15;
          }
        }
      `}</style>

      <style jsx>{`
        /* ════════════════════════════════════════════
           THEME TOKENS: DARK (DEFAULT)
           ════════════════════════════════════════════ */
        .formula-notes-page {
          --bg: #000000;
          --card-bg: #1c1c1e;
          --card-hover: #242428;
          --border: rgba(255, 255, 255, 0.09);
          --header-bg: rgba(0, 0, 0, 0.9);
          --text-primary: #f8fafc;
          --text-secondary: rgba(235, 235, 245, 0.6);
          --text-tertiary: rgba(235, 235, 245, 0.35);
          --tab-bg: rgba(255, 255, 255, 0.08);
          --tab-color: rgba(235, 235, 245, 0.75);
          --accent: #007aff;
          --modal-bg: #1c1c1e;
          --modal-option-bg: #28282c;
          --notice-color: rgba(235, 235, 245, 0.5);
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

        /* ── Fixed Position Top Area: Header + Filter Box ── */
        .fn-top-pinned {
          flex-shrink: 0;
          z-index: 30;
          background: var(--header-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding-top: var(--safe-top);
        }

        .fn-header {
          border-bottom: none;
        }

        .fn-header-inner {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          max-width: 680px;
          margin: 0 auto;
        }

        .fn-header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .fn-back-btn,
        .fn-search-btn,
        .fn-add-btn {
          width: 40px;
          height: 40px;
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
        }

        .fn-back-btn:hover,
        .fn-search-btn:hover,
        .fn-add-btn:hover {
          background: var(--tab-bg);
        }

        .fn-back-btn:active,
        .fn-search-btn:active,
        .fn-add-btn:active {
          opacity: 0.6;
          transform: scale(0.95);
        }

        .fn-search-btn.active {
          background: var(--accent);
          color: #ffffff;
        }

        .fn-add-btn:disabled {
          opacity: 0.4;
          cursor: wait;
        }

        .fn-header-title {
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

        /* ── Search Bar Dropdown ── */
        .fn-search-bar {
          padding: 0 16px 10px;
          max-width: 680px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          animation: fn-slide-down 0.2s ease;
        }

        @keyframes fn-slide-down {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fn-search-input-wrap {
          position: relative;
          width: 100%;
          display: block;
        }

        .fn-search-input {
          width: 100%;
          height: 38px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          font-size: 14px;
          padding: 0 36px 0 36px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .fn-search-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.22);
        }

        .fn-search-input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .fn-search-clear {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--tab-bg);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        /* ── Fixed Position Filter Box (Category Tabs) ── */
        .fn-filter-box {
          max-width: 680px;
          margin: 0 auto;
          padding: 4px 16px 12px;
        }

        .fn-tabs-wrapper {
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .fn-tabs-wrapper::-webkit-scrollbar {
          display: none;
        }

        .fn-tabs {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 100%;
        }

        .fn-tab-pill {
          padding: 7px 16px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--tab-color);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .fn-tab-pill:active {
          transform: scale(0.96);
        }

        .fn-tab-pill.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          box-shadow: 0 2px 10px rgba(0, 122, 255, 0.35);
        }

        /* ── Scrollable PDF Cards Area Only ── */
        .fn-scroll-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          scrollbar-width: thin;
        }

        .fn-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          padding: 16px 16px calc(92px + var(--safe-bottom));
          box-sizing: border-box;
        }

        /* ── Notices & Error State ── */
        :global(.fn-loading-state),
        .fn-loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(75dvh - 120px);
          gap: 14px;
          animation: fn-fade-up 0.25s ease;
          margin: auto 0;
          transform: translateY(-30px);
          text-align: center;
          width: 100%;
        }

        :global(.ios-spinner),
        .ios-spinner {
          display: inline-block;
          color: var(--spinner-color);
          flex-shrink: 0;
        }

        :global(.fn-loading-text),
        .fn-loading-text {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: -0.01em;
          margin: 0;
          text-align: center;
        }

        .fn-status-notice {
          text-align: center;
          font-size: 13px;
          color: var(--notice-color);
          padding: 6px 0 12px;
        }

        .fn-error-state {
          text-align: center;
          padding: 24px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .fn-error-text {
          font-size: 13.5px;
          color: var(--notice-color);
          margin: 0;
        }

        .fn-retry-btn {
          padding: 6px 18px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .fn-retry-btn:hover {
          background: var(--card-hover);
        }

        /* ── PDF Cards List ── */
        .fn-card-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .fn-card {
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
          transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          -webkit-tap-highlight-color: transparent;
          animation: fn-fade-up 0.28s ease both;
        }

        @keyframes fn-fade-up {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fn-card:hover {
          background: var(--card-hover);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }

        .fn-card:active {
          transform: scale(0.99);
        }

        .fn-card-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .fn-card-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .fn-card-title {
          font-size: 14.5px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .fn-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .fn-card-tag {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--tab-bg);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .fn-card-date {
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        .fn-card-arrow {
          color: var(--text-tertiary);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: transform 0.15s ease, color 0.15s ease;
        }

        .fn-card:hover .fn-card-arrow {
          color: var(--text-primary);
          transform: translateX(2px);
        }

        /* ── Empty State ── */
        .fn-empty-state {
          text-align: center;
          padding: 56px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .fn-empty-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: var(--tab-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-tertiary);
          margin-bottom: 14px;
        }

        .fn-empty-title {
          font-size: 16px;
          font-weight: 650;
          color: var(--text-primary);
          margin: 0 0 6px;
        }

        .fn-empty-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 290px;
          line-height: 1.4;
        }

        .fn-empty-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 18px;
          padding: 10px 20px;
          border-radius: 999px;
          border: none;
          background: var(--accent);
          color: #ffffff;
          font-size: 13.5px;
          font-weight: 650;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.35);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .fn-empty-add-btn:active {
          transform: scale(0.96);
        }

        .fn-empty-add-btn:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        /* ── Floating Action Button (FAB) ── */
        .fn-fab {
          position: fixed;
          right: max(20px, calc(16px + var(--safe-right)));
          bottom: max(24px, calc(20px + var(--safe-bottom)));
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
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

        .fn-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 22px rgba(0, 122, 255, 0.55);
        }

        .fn-fab:active {
          transform: scale(0.92);
        }

        .fn-fab:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .pdf-input {
          display: none;
        }

        /* ── Add Modal ── */
        .modal-backdrop {
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
          animation: fn-fade-in 0.18s ease;
        }

        @keyframes fn-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .add-modal {
          width: min(100%, 400px);
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--modal-bg);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          padding: 20px;
          margin-bottom: var(--safe-bottom);
          animation: fn-modal-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fn-modal-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .add-modal h2 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .modal-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .modal-option {
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid var(--border);
          color: var(--text-primary);
          background: var(--modal-option-bg);
          font-size: 13.5px;
          font-weight: 650;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }

        .modal-option:active {
          transform: scale(0.97);
        }

        .modal-cancel {
          width: 100%;
          min-height: 44px;
          margin-top: 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .modal-cancel:hover {
          background: var(--tab-bg);
        }

        /* ════════════════════════════════════════════
           LIGHT THEME OVERRIDES (body.theme-light)
           ════════════════════════════════════════════ */
        :global(body.theme-light) .formula-notes-page {
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
          --notice-color: #57606a;
          --spinner-color: rgba(60, 60, 67, 0.6);
        }

        :global(body.theme-light) .fn-card {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        :global(body.theme-light) .fn-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          border-color: rgba(0, 0, 0, 0.14);
        }
      `}</style>
    </main>
  );
}
