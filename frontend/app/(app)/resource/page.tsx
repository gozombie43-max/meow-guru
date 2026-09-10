"use client";

import { API_BASE } from "@/lib/api-base";
import { resourcePageStyles } from "./resource.styles";
import ResourceUploadDialog from "./ResourceUploadDialog";
import { fetchWithRetry } from "@/lib/api/http";
import { announceFeedback } from "@/lib/feedback";
import {
ChevronLeft,
ChevronRight,
FileText,
Plus,
Search,
X,
} from "lucide-react";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

import {
  IosSpinner,
  PdfIcon,
  formatDate,
  formatSize,
  getCategory,
  resourceTabs,
  sortFiles,
  subjects,
  type ResourceFile,
  type ResourceTab,
  type SubjectId,
} from "./resource-model";

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
        window.location.assign(data.url);
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
                  className="res-search-input"
                 aria-label={`Search ${selectedSubject.label} ${activeTab}...`}/>
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
       aria-label="Choose file"/>

      {/* ── Upload Destination Modal ── */}
      {showUploadModal && (
        <ResourceUploadDialog
          activeSubject={activeSubject}
          activeTab={activeTab}
          onBeginUpload={beginUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}

      <style jsx>{resourcePageStyles}</style>
    </main>
  );
}
