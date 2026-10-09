"use client";
import styles from "./FormulaNotes.module.css";
import "./FormulaNotes.globals.css";
import { bindStyleClasses } from "@/lib/styleClasses";
const styleClasses = bindStyleClasses(styles);
import { Dialog } from "@/components/ui/Dialog";
import { requestResponse as fetch } from "@/shared/api/request";


import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import { ChevronLeft,ChevronRight,FileText,Plus,Search,X } from "lucide-react";
import { useParams,useRouter } from "next/navigation";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

const pendingPdfs = new Map<string, Promise<TopicPdf[]>>();

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
  simplification: "Simplification",
  "lcm-and-hcf": "LCM & HCF",
  "problems-on-ages": "Problems on Ages",
  "pipes-and-cisterns": "Pipes & Cisterns",
  "calendar-and-clock": "Calendar & Clock",
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
    width="30"
    height="30"
    className={styleClasses("fn-pdf-icon")}
    style={{ filter: "drop-shadow(0 2px 4px rgba(173, 11, 0, 0.25))" }}
  >
    {/* Document sheet and folded corner in #AD0B00 */}
    <path
      fill="#AD0B00"
      d="M 12.5 4 C 10.019 4 8 6.019 8 8.5 L 8 39.5 C 8 41.981 10.019 44 12.5 44 L 35.5 44 C 37.981 44 40 41.981 40 39.5 L 40 20 L 28.5 20 C 26.019 20 24 17.981 24 15.5 L 24 4 L 12.5 4 z M 27 4.8789062 L 27 15.5 C 27 16.327 27.673 17 28.5 17 L 39.121094 17 L 27 4.8789062 z"
    />
    {/* Inner Acrobat Ribbon in white */}
    <path
      fill="#ffffff"
      d="M 22.5 21 C 23.878 21 25 22.121 25 23.5 C 25 25.306 24.701422 27.117172 24.232422 28.826172 C 24.656422 29.400172 25.126953 29.950125 25.626953 30.453125 C 27.148953 30.169125 28.785 30 30.5 30 C 31.878 30 33 31.121 33 32.5 C 33 33.879 31.878 35 30.5 35 C 28.574 35 26.664719 34.043094 25.011719 32.621094 C 24.134719 32.821094 23.310828 33.059359 22.548828 33.318359 C 21.359828 35.804359 20.013406 37.669891 19.191406 38.337891 C 18.650406 38.777891 18.082 39 17.5 39 C 16.833 39 16.205422 38.739578 15.732422 38.267578 C 15.259422 37.795578 15 37.168 15 36.5 C 15 35.81 15.276812 35.156031 15.757812 34.707031 C 16.714813 33.813031 18.580312 32.662656 21.070312 31.722656 C 21.421312 30.933656 21.755969 30.081547 22.042969 29.185547 C 20.779969 27.232547 20 25.137 20 23.5 C 20 22.121 21.122 21 22.5 21 z M 22.5 23 C 22.224 23 22 23.225 22 23.5 C 22 24.315 22.274047 25.306891 22.748047 26.337891 C 22.908047 25.407891 23 24.457 23 23.5 C 23 23.225 22.776 23 22.5 23 z M 30.5 32 C 29.557 32 28.643578 32.054344 27.767578 32.152344 C 28.665578 32.682344 29.596 33 30.5 33 C 30.776 33 31 32.775 31 32.5 C 31 32.225 30.776 32 30.5 32 z M 19.59375 34.558594 C 18.43575 35.151594 17.587094 35.735922 17.121094 36.169922 C 17.011094 36.273922 17 36.436 17 36.5 C 17 36.577 17.019484 36.725516 17.146484 36.853516 C 17.273484 36.981516 17.423 37 17.5 37 C 17.606 37 17.759687 36.924156 17.929688 36.785156 L 17.929688 36.783203 C 18.258688 36.515203 18.88875 35.721594 19.59375 34.558594 z"
    />
  </svg>
);

const IosSpinner = ({ size = 34 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={styleClasses("ios-spinner")}
    role="status"
    aria-label="Loading"
    style={{
      display: "block",
      margin: "0 auto",
      color: "var(--spinner-color, #8E8E93)",
    }}
  >
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
  useEffect(() => {
    document.body.classList.add('formula-notes-route');
    return () => document.body.classList.remove('formula-notes-route');
  }, []);

  const router = useRouter();
  const params = useParams();
  const routeTopic = Array.isArray(params.topic) ? params.topic[0] : params.topic;
  const topic = topicProp || String(routeTopic || "");
  const topicLabel = topicLabelProp || getTopicLabel(topic);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
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

  const API = API_BASE;
  const apiUrl = useCallback((path: string) => (API ? `${API}${path}` : path), [API]);
  const categoryFromTab = useCallback((tab: string) => tab.toLowerCase(), []);

  const getCachedPdfs = useCallback(
    (cat: string): TopicPdf[] | null => {
      if (cacheRef.current[`${topic}:${cat}`] !== undefined) return cacheRef.current[`${topic}:${cat}`];
      if (typeof window !== "undefined") {
        try {
          const stored =
            localStorage.getItem(`fn_cache_${topic}_${cat}`) ||
            sessionStorage.getItem(`fn_cache_${topic}_${cat}`);
          if (stored) {
            const parsed = JSON.parse(stored) as TopicPdf[];
            if (Array.isArray(parsed)) {
              cacheRef.current[`${topic}:${cat}`] = parsed;
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
      cacheRef.current[`${topic}:${cat}`] = data;
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

  const requestCategory = useCallback((tab: string) => {
    const category = categoryFromTab(tab);
    const url = apiUrl(`/api/pdfs?topic=${encodeURIComponent(topic)}&category=${encodeURIComponent(category)}`);
    let pending = pendingPdfs.get(url);
    if (!pending) {
      pending = fetchWithRetry(url, {}, { timeoutMs: 8000, retries: 1 }).then(async response => {
        if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`);
        const data = await response.json() as { pdfs?: TopicPdf[] };
        return sortByName(data.pdfs ?? []);
      }).finally(() => pendingPdfs.delete(url));
      pendingPdfs.set(url, pending);
    }
    return pending.then(files => { setCachedPdfs(category, files); return files; });
  }, [apiUrl, categoryFromTab, setCachedPdfs, topic]);

  const fetchCategoryPdfs = useCallback(async (tab: string, bypassCache = false) => {
    if (!topic) return;
    const request = ++requestRef.current;
    const cached = bypassCache ? null : getCachedPdfs(categoryFromTab(tab));
    setPdfs(cached ?? []);
    setLoading(cached === null);
    setNotice('');
    try {
      const files = await requestCategory(tab);
      if (request === requestRef.current) setPdfs(files);
    } catch (error) {
      if (request === requestRef.current && cached === null) setNotice('Unable to load PDFs. Please try again.');
      console.warn('Could not load PDFs:', error);
    } finally { if (request === requestRef.current) setLoading(false); }
  }, [topic, getCachedPdfs, categoryFromTab, requestCategory]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchCategoryPdfs(activeTab), 0);
    const invalidate = () => { requestRef.current++; };
    return () => { window.clearTimeout(timer); invalidate(); };
  }, [activeTab, fetchCategoryPdfs]);

  const prefetchTab = (tab: string) => {
    if (getCachedPdfs(categoryFromTab(tab)) === null) void requestCategory(tab).catch(() => {});
  };

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
        window.location.assign(data.url);
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
    const parent = window.location.pathname.replace(/\/formula-notes\/?$/, "");
    router.replace(parent !== window.location.pathname ? parent : fallbackBackHref);
  };

  return (
    <main className={styleClasses("formula-notes-page")}>
      {/* ── Fixed Position Top Area: Header + Filter Box ── */}
      <div className={styleClasses("fn-top-pinned")}>
        <header data-ui-chrome="header" className={styleClasses("fn-header")}>
          <div className={styleClasses("fn-header-inner")}>
            <button data-ui-button="icon"
              type="button"
              className={styleClasses("fn-back-btn")}
              onClick={handleBack}
              aria-label="Back"
            >
              <ChevronLeft size={22} />
            </button>
            <h1 className={styleClasses("fn-header-title")}>{topicLabel}</h1>
            <div className={styleClasses("fn-header-actions")}>
              <button data-ui-button="state" data-ui-shape="icon"
                type="button"
                className={styleClasses(`fn-search-btn ${isSearchOpen ? "active" : ""}`)}
                onClick={() => {
                  setIsSearchOpen((prev) => !prev);
                  if (isSearchOpen) setSearchQuery("");
                }}
                aria-label="Search files"
              >
                {isSearchOpen ? <X size={19} /> : <Search size={19} />}
              </button>
              {!loading && pdfs.length === 0 ? (
                <button data-ui-button="state" data-ui-shape="icon"
                  type="button"
                  className={styleClasses("fn-add-btn")}
                  onClick={() => setShowAddModal(true)}
                  aria-label={`Add files to ${topicLabel}`}
                  disabled={uploading}
                >
                  <Plus size={21} />
                </button>
              ) : null}
            </div>
          </div>

          {isSearchOpen ? (
            <div className={styleClasses("fn-search-bar")}>
              <div className={styleClasses("fn-search-input-wrap")}>
                <span className={styleClasses("fn-search-input-icon")}>
                  <Search size={15} />
                </span>
                <input
                  type="search" spellCheck={false} autoCapitalize="none" autoCorrect="off" autoComplete="off"
                  className={styleClasses("fn-search-input")}
                  placeholder={`Search in ${activeTab}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                 aria-label={`Search in ${activeTab}...`}/>
                {searchQuery ? (
                  <button data-ui-button="secondary"
                    type="button"
                    className={styleClasses("fn-search-clear")}
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
        <div className={styleClasses("fn-filter-box")}>
          <div className={styleClasses("fn-tabs-wrapper")}>
            <div className={styleClasses("fn-tabs")} role="tablist" aria-label="PDF categories">
              {tabs.map((tab) => (
                <button data-ui-button="state"
                  key={tab}
                  onPointerEnter={() => prefetchTab(tab)}
                  onFocus={() => prefetchTab(tab)}
                  type="button"
                  className={styleClasses(`fn-tab-pill ${tab === activeTab ? "active" : ""}`)}
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
      <div className={styleClasses("fn-scroll-body")}>
        <div className={styleClasses("fn-content")}>
          {/* ── First-Time Documents Loading: iOS Spinner ── */}
          {loading && pdfs.length === 0 ? (
            <div className={styleClasses("fn-loading-state")} role="status" aria-label="Loading documents">
              <IosSpinner size={34} />
              <p className={styleClasses("fn-loading-text")}>Loading documents...</p>
            </div>
          ) : notice ? (
            <div className={styleClasses("fn-error-state")}>
              <p className={styleClasses("fn-error-text")}>{notice}</p>
              <button data-ui-button="state"
                type="button"
                className={styleClasses("fn-retry-btn")}
                onClick={() => fetchCategoryPdfs(activeTab, true)}
              >
                Retry
              </button>
            </div>
          ) : (
            /* ── File Cards List ── */
            <section className={styleClasses("fn-card-list")}>
              {filteredPdfs.length > 0 ? (
                filteredPdfs.map((pdf, index) => (
                  <button data-ui-button="state"
                    key={pdf.id}
                    onClick={() => openPdf(pdf)}
                    type="button"
                    className={styleClasses("fn-card")}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className={styleClasses("fn-card-icon-wrap")} aria-hidden="true">
                      <PdfIcon />
                    </div>
                    <div className={styleClasses("fn-card-body")}>
                      <span className={styleClasses("fn-card-title")}>
                        {pdf.title || pdf.fileName || `${topicLabel} PDF`}
                      </span>
                      <div className={styleClasses("fn-card-meta")}>
                        <span className={styleClasses("fn-card-tag")}>{formatSize(pdf.size, pdf.fileName)}</span>
                        {pdf.updatedAt || pdf.uploadedAt ? (
                          <span className={styleClasses("fn-card-date")}>
                            {formatDate(pdf.updatedAt || pdf.uploadedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className={styleClasses("fn-card-arrow")} aria-hidden="true">
                      <ChevronRight size={18} />
                    </div>
                  </button>
                ))
              ) : !loading && !notice ? (
                <div className={styleClasses("fn-empty-state")}>
                  <div className={styleClasses("fn-empty-icon")} aria-hidden="true">
                    <FileText size={32} strokeWidth={1.5} />
                  </div>
                  <p className={styleClasses("fn-empty-title")}>
                    {searchQuery ? "No matching files" : "No files found"}
                  </p>
                  <p className={styleClasses("fn-empty-sub")}>
                    {searchQuery
                      ? `No files match "${searchQuery}" in ${activeTab}.`
                      : `There are currently no files in the ${activeTab} category.`}
                  </p>
                  {!searchQuery ? (
                    <button data-ui-button="state"
                      type="button"
                      className={styleClasses("fn-empty-add-btn")}
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
        className={styleClasses("pdf-input")}
        onChange={handlePdfUpload}
       aria-label="Choose file"/>

      {/* ── Floating Action Button (FAB) ── */}
      {pdfs.length > 0 ? (
        <button data-ui-button="state" data-ui-shape="icon"
          className={styleClasses("fn-fab")}
          type="button"
          aria-label={`Add files to ${topicLabel}`}
          disabled={uploading}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={24} />
        </button>
      ) : null}

      {/* ── Category Choice Modal ── */}
      {showAddModal ? (
        <div className={styleClasses("modal-backdrop")}>
          <Dialog onClose={() => setShowAddModal(false)}
            className={styleClasses("add-modal")}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-pdf-title"
          >
            <h2 id="add-pdf-title">Add files to</h2>
            <div className={styleClasses("modal-options")}>
              {tabs.map((tab) => {
                const category = categoryFromTab(tab);
                return (
                  <button data-ui-button="state"
                    key={tab}
                    type="button"
                    className={styleClasses("modal-option")}
                    onClick={() => chooseUploadCategory(category)}
                  >
                    {tab.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <button data-ui-button="secondary" type="button" className={styleClasses("modal-cancel")} onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
          </Dialog>
        </div>
      ) : null}
    </main>
  );
}
