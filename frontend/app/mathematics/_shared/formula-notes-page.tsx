"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
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
  return TOPIC_LABELS[topic] ?? topic
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function sortByName(files: TopicPdf[]) {
  return [...files].sort((a, b) =>
    nameCollator.compare(a.title || a.fileName || "", b.title || b.fileName || "")
  );
}

export default function FormulaNotesPage({
  topic: topicProp,
  subject = "Mathematics",
}: {
  topic?: string;
  subject?: string;
}) {
  const params = useParams();
  const routeTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const topic = topicProp || String(routeTopic || "");
  const topicLabel = getTopicLabel(topic);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("Notes");
  const [pdfs, setPdfs] = useState<TopicPdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("notes");

  const API = process.env.NEXT_PUBLIC_API_URL || "";
  const apiUrl = useCallback((path: string) => (API ? `${API}${path}` : path), [API]);
  const categoryFromTab = useCallback((tab: string) => tab.toLowerCase(), []);

  useEffect(() => {
    const fetchPdfs = async () => {
      if (!topic) return;
      setLoading(true);
      setNotice("");
      try {
        const category = categoryFromTab(activeTab);
        const res = await fetchWithRetry(
          apiUrl(`/api/pdfs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`)
        );
        if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
        const data = (await res.json()) as { pdfs?: TopicPdf[] };
        setPdfs(sortByName(data.pdfs || []));
      } catch (err) {
        console.error("Failed to load PDFs", err);
        setNotice("Unable to load PDFs.");
      } finally {
        setLoading(false);
      }
    };
    fetchPdfs();
  }, [activeTab, apiUrl, categoryFromTab, topic]);

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
        setPdfs((current) => sortByName([...current, ...visibleUploads]));
      }
      setNotice(`${uploadedFiles.length} file${uploadedFiles.length === 1 ? "" : "s"} uploaded to ${uploadCategory.toUpperCase()}.`);
    } catch (err) {
      console.error("Failed to upload files", err);
      setNotice(err instanceof Error ? err.message : "File upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="formula-notes-page">
      <div className="background-orb orb-1" aria-hidden="true" />
      <div className="background-orb orb-2" aria-hidden="true" />

      <div className="page-shell">
        <header className="top-bar">
          <div className="title-block">
            <p className="eyebrow">{subject}</p>
            <p className="topic-name">{topicLabel}</p>
            <h1>Notes Formula &amp; Tricks</h1>
            <p className="subtitle">{topicLabel} insights wrapped in a liquid glass layout.</p>
          </div>
          <button className="search-button" type="button" aria-label="Search PDFs">
            <Search className="icon" />
          </button>
        </header>

        <div className="tab-row" role="tablist" aria-label={`${topicLabel} PDF categories`}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-pill${tab === activeTab ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={tab === activeTab}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        <section className="glass-container">
          {pdfs.length > 0 ? (
            pdfs.map((pdf, index) => (
              <button
                key={pdf.id}
                onClick={() => openPdf(pdf)}
                type="button"
                className="glass-card note-card"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="note-icon-bg" aria-hidden="true">
                  <FileText className="note-icon" />
                </span>
                <span className="note-main">
                  <span className="note-title">{pdf.title || pdf.fileName || `${topicLabel} PDF`}</span>
                </span>
                <span className="note-time">
                  {formatDate(pdf.updatedAt || pdf.uploadedAt) || formatSize(pdf.size, pdf.fileName)}
                </span>
              </button>
            ))
          ) : (
            <div className="empty-state">No files found.</div>
          )}
          {showSyncing ? <div className="inline-notice">Loading files...</div> : null}
          {notice ? <div className="inline-notice">{notice}</div> : null}
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,text/html,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.html,.htm,.doc,.docx"
        multiple
        className="pdf-input"
        onChange={handlePdfUpload}
      />

      <button
        className="fab-button"
        type="button"
        aria-label={`Add ${topicLabel} files`}
        disabled={uploading}
        onClick={() => setShowAddModal(true)}
      >
        <Plus className="fab-icon" />
      </button>

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
        @import url("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap");

        .bottom-pill-nav {
          display: none !important;
        }

        body.has-bottom-nav {
          padding-bottom: 0 !important;
        }
      `}</style>

      <style jsx>{`
        .formula-notes-page {
          --primary-blue: #007aff;
          --bg-start: #f0f0f5;
          --bg-end: #e8e8f0;
          --text-primary: rgba(0, 0, 0, 0.8);
          --text-secondary: rgba(0, 0, 0, 0.4);
          --glass-edge: rgba(255, 255, 255, 0.7);
          min-height: 100vh;
          background: linear-gradient(180deg, var(--bg-start) 0%, var(--bg-end) 100%);
          color: var(--text-primary);
          font-family: "General Sans", "SF Pro Display", "Segoe UI", sans-serif;
          padding: 28px 18px 92px;
          position: relative;
          overflow: hidden;
          height: 100vh;
          height: 100dvh;
        }

        .background-orb {
          position: absolute;
          border-radius: 999px;
          filter: blur(40px);
          opacity: 0.7;
          pointer-events: none;
        }

        .orb-1 {
          width: 220px;
          height: 220px;
          background: rgba(0, 122, 255, 0.22);
          top: -70px;
          right: -50px;
        }

        .orb-2 {
          width: 280px;
          height: 280px;
          background: rgba(255, 255, 255, 0.7);
          bottom: -140px;
          left: -120px;
        }

        .page-shell {
          max-width: 560px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .top-bar {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 12px;
          flex: 0 0 auto;
        }

        .title-block h1 {
          margin: 6px 0 4px;
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0;
        }

        .eyebrow {
          margin: 0;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 600;
        }

        .topic-name {
          margin: 8px 0 0;
          font-size: 0.82rem;
          font-weight: 700;
          color: rgba(0, 0, 0, 0.62);
        }

        .subtitle {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-secondary);
        }

        .search-button {
          border: none;
          background: rgba(255, 255, 255, 0.9);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          cursor: pointer;
        }

        .search-button:active {
          transform: scale(0.98);
        }

        .search-button:focus-visible {
          outline: 2px solid rgba(0, 122, 255, 0.5);
          outline-offset: 3px;
        }

        .icon {
          width: 18px;
          height: 18px;
          color: rgba(0, 0, 0, 0.5);
        }

        .tab-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding-bottom: 6px;
          margin-bottom: 12px;
          scrollbar-width: none;
          position: sticky;
          top: 0;
          z-index: 3;
          flex: 0 0 auto;
        }

        .tab-row::-webkit-scrollbar {
          display: none;
        }

        .tab-pill {
          border: none;
          background: rgba(255, 255, 255, 0.75);
          color: rgba(0, 0, 0, 0.55);
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 8px 14px;
          border-radius: 999px;
          cursor: pointer;
        }

        .tab-pill.is-active {
          color: #ffffff;
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.9) 0%, rgba(0, 100, 220, 0.95) 100%);
          box-shadow:
            0 2px 8px rgba(0, 122, 255, 0.35),
            0 1px 3px rgba(0, 122, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
        }

        .tab-pill:active {
          transform: scale(0.98);
        }

        .glass-container {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.25) 100%);
          backdrop-filter: blur(60px) saturate(2);
          -webkit-backdrop-filter: blur(60px) saturate(2);
          box-shadow:
            0 2px 20px rgba(0, 0, 0, 0.06),
            0 0 0 0.5px rgba(255, 255, 255, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border: 0.5px solid rgba(255, 255, 255, 0.5);
          border-radius: 26px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          scrollbar-width: thin;
        }

        .glass-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.6) 40%, rgba(255, 255, 255, 0.75) 100%);
          backdrop-filter: blur(40px) saturate(1.8);
          -webkit-backdrop-filter: blur(40px) saturate(1.8);
          box-shadow:
            0 1px 3px rgba(0, 0, 0, 0.04),
            0 4px 12px rgba(0, 0, 0, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.9),
            inset 0 -1px 0 rgba(255, 255, 255, 0.3);
          border: 0.5px solid var(--glass-edge);
        }

        .note-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 20px;
          border: none;
          text-align: left;
          cursor: pointer;
          animation: fade-up 0.5s ease both;
        }

        .note-card:active {
          transform: scale(0.98);
        }

        .note-card:focus-visible {
          outline: 2px solid rgba(0, 122, 255, 0.35);
          outline-offset: 3px;
        }

        .note-icon-bg {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.82) 100%);
          flex-shrink: 0;
        }

        .note-icon {
          width: 18px;
          height: 18px;
          color: rgba(0, 0, 0, 0.35);
        }

        .note-main {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .note-title {
          font-size: 0.95rem;
          font-weight: 560;
          line-height: 1.18;
          color: rgba(0, 0, 0, 0.74);
          overflow-wrap: anywhere;
        }

        .note-time {
          font-size: 0.72rem;
          color: var(--text-secondary);
          font-weight: 500;
          white-space: nowrap;
          margin-left: auto;
        }

        .empty-state,
        .inline-notice {
          text-align: center;
          color: rgba(0, 0, 0, 0.5);
        }

        .empty-state {
          padding: 1rem;
        }

        .inline-notice {
          padding: 0.4rem 0;
          font-size: 0.75rem;
        }

        .fab-button {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.92) 0%, rgba(0, 100, 220, 0.98) 100%);
          box-shadow:
            0 4px 16px rgba(0, 122, 255, 0.4),
            0 2px 6px rgba(0, 122, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
        }

        .fab-button:disabled {
          cursor: wait;
          opacity: 0.72;
        }

        .fab-button:active {
          transform: scale(0.98);
        }

        .fab-icon {
          width: 24px;
          height: 24px;
          color: #ffffff;
        }

        .pdf-input {
          display: none;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 20;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 18px;
          background: rgba(15, 23, 42, 0.22);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .add-modal {
          width: min(100%, 420px);
          border-radius: 24px;
          border: 0.5px solid rgba(255, 255, 255, 0.64);
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
          padding: 18px;
        }

        .add-modal h2 {
          margin: 0 0 14px;
          font-size: 1rem;
          font-weight: 700;
          color: rgba(0, 0, 0, 0.76);
        }

        .modal-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .modal-option,
        .modal-cancel {
          border: none;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
        }

        .modal-option {
          min-height: 48px;
          border-radius: 16px;
          color: rgba(0, 0, 0, 0.68);
          background: rgba(245, 247, 252, 0.96);
          box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.06);
        }

        .modal-option:active,
        .modal-cancel:active {
          transform: scale(0.98);
        }

        .modal-cancel {
          width: 100%;
          min-height: 46px;
          margin-top: 10px;
          border-radius: 16px;
          color: #ffffff;
          background: linear-gradient(135deg, rgba(0, 122, 255, 0.92) 0%, rgba(0, 100, 220, 0.98) 100%);
        }

        @keyframes fade-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 520px) {
          .formula-notes-page {
            padding: 20px 18px 76px;
          }

          .top-bar {
            position: relative;
            display: block;
            padding-right: 58px;
            margin-bottom: 10px;
          }

          .search-button {
            position: fixed;
            top: 20px;
            right: 18px;
            z-index: 6;
            background: rgba(255, 255, 255, 0.96);
            box-shadow:
              0 8px 22px rgba(15, 23, 42, 0.12),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
          }

          .tab-row {
            margin-bottom: 10px;
            padding-bottom: 4px;
          }

          .note-card {
            align-items: center;
            gap: 12px;
          }

          .note-main {
            width: 100%;
            flex: 1 1 auto;
          }

          .note-title {
            font-size: 0.9rem;
            font-weight: 540;
            line-height: 1.2;
            color: rgba(0, 0, 0, 0.7);
            overflow-wrap: normal;
            word-break: normal;
          }

          .note-time {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}
