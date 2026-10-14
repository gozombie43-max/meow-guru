"use client";

// Shared chapter hub for General Awareness and IIT JAM Physics.

import MicIcon from "@/components/MicIcon";
import TopicThumbnail from "@/components/subject-hub/TopicThumbnail";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import { chapterImage } from "@/lib/topic-images";
import { useBackLayer } from "@/hooks/useAppNavigation";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import hubStyles from "@/components/SubjectHub.module.css";
import type {
RankedTopicGroup,
RankedTopicPriority,
} from "@/lib/ranked-topic-groups";


interface SpeechRecognitionResultEvent {
  results?: { [index: number]: { [index: number]: { transcript?: string } } };
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import styles from "./RankedTopicGroupPage.module.css";

type PriorityFilter = RankedTopicPriority | "All";

const PRIORITY_CLASS: Record<RankedTopicPriority, string> = {
  "Very High": styles.veryHigh,
  Core: styles.veryHigh,
  High: styles.high,
  Medium: styles.medium,
  Lower: styles.lower,
};

export default function RankedTopicGroupPage({ group, subject = "general-awareness", routeBase = `/general-awareness/${group.slug}`, backHref = "/general-awareness", backLabel = "General Awareness" }: {
  group: RankedTopicGroup;
  subject?: string;
  routeBase?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { data } = useTopicQuestionTotals(subject);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<PriorityFilter>("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  useBackLayer(filterOpen, () => setFilterOpen(false));

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (!filterOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    const positionDialog = () => {
      const trigger = filterTriggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const top = bounds.bottom + 8;
      dialog.style.top = `${top}px`;
      dialog.style.right = `${Math.max(12, window.innerWidth - bounds.right)}px`;
      dialog.style.maxHeight = `max(44px, calc(100dvh - ${top + 12}px))`;
    };
    positionDialog();
    if (!dialog.open) dialog.showModal();
    window.addEventListener('resize', positionDialog);
    return () => window.removeEventListener('resize', positionDialog);
  }, [filterOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPriority("All"), 0);
    return () => window.clearTimeout(timer);
  }, [group.slug, group.filters]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const toggleVoiceSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionClass =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Voice search is not supported in this browser.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionResultEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setQuery(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }, [isListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const topics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return group.topics.filter((topic) => {
      const matchesQuery =
        normalizedQuery === "" || topic.title.toLowerCase().includes(normalizedQuery);
      const matchesPriority =
        normalizedQuery !== "" || priority === "All" || topic.priority === priority;
      return matchesQuery && matchesPriority;
    });
  }, [group.topics, priority, query]);

  const filters = useMemo<readonly PriorityFilter[]>(
    () => ["All", ...group.filters],
    [group.filters]
  );

  const filterButton = (
    <button
      type="button"
      data-ui-button="state"
      data-ui-shape="icon"
      className={styles.headerFilter}
      aria-label={`Filter chapters, ${priority} selected`}
      aria-haspopup="dialog"
      aria-expanded={filterOpen}
      aria-controls="chapter-filter-dialog"
      onClick={(event) => {
        filterTriggerRef.current = event.currentTarget;
        setFilterOpen(true);
      }}
    >
      <SlidersHorizontal size={20} aria-hidden="true" />
    </button>
  );

  return (
    <div className={styles.page}>
      {/* =========================================================================
          DESKTOP VIEW (>= 768px)
          ========================================================================= */}
      <div className={styles.desktopContainer}>
        <header data-ui-chrome="header" className={styles.header}>
          <Link replace data-ui-button="secondary"
            href={backHref}
            className={styles.backButton}
            aria-label={`Back to ${backLabel}`}
          >
            <ChevronLeft size={23} strokeWidth={2.2} />
          </Link>
          <h1 className={styles.headerTitle}>{group.label}</h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <main className={styles.content}>
          <section className={styles.intro} aria-labelledby="ranked-topics-heading">
            <p className={styles.eyebrow}>{group.eyebrow}</p>
            <h2 id="ranked-topics-heading" className={styles.heading}>
              {group.topics.length} chapters{group.filters.length ? ", ranked" : ""}
            </h2>
            <p className={styles.description}>
              {group.description}
            </p>
          </section>

          <div className={styles.searchWrap}>
            <Search className={styles.searchIcon} size={17} aria-hidden="true" />
            <input
              className={styles.searchInput}
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Search ${group.label.toLowerCase()} chapters`}
              aria-label={`Search ${group.label} chapters`}
            />
            {query ? (
              <button data-ui-button="secondary"
                type="button"
                className={styles.clearButton}
                onClick={() => setQuery("")}
                aria-label="Clear chapter search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <section className={styles.table} aria-label={`Ranked ${group.label} chapters`}>
            <div className={styles.tableHeader} aria-hidden="true">
              <span>Rank</span>
              <span>Chapter</span>
              <span>{group.filters.length ? group.metricLabel : ""}</span>
            </div>

            {topics.length > 0 ? (
              topics.map((topic) => (
                <Link
                  key={topic.slug}
                  className={styles.row}
                  href={`${routeBase}/${topic.slug}`}
                  aria-label={group.filters.length ? `Rank ${topic.rank}: ${topic.title}, ${topic.priority} ${group.metricLabel.toLowerCase()}. Open topic.` : `${topic.rank}. ${topic.title}. Open chapter.`}
                >
                  <span className={styles.rank}>{topic.rank}</span>
                  <span className={styles.chapterCell}>
                    <span className={styles.chapterPhoto} aria-hidden="true"><TopicThumbnail src={chapterImage(topic.slug, group.slug)} size={48} /></span>
                    <span className={styles.chapter}>{topic.title}<span className={styles.chapterQuestionCount}>{data?.totals?.[topic.slug] ?? 0} Questions</span></span>
                  </span>
                  <span className={styles.weightage} hidden={!group.filters.length}>
                    <span
                      className={`${styles.weightDot} ${PRIORITY_CLASS[topic.priority]}`}
                      aria-hidden="true"
                    />
                    {topic.priority}
                  </span>
                </Link>
              ))
            ) : (
              <div className={styles.empty}>No chapters match your search.</div>
            )}
          </section>
        </main>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (< 768px Handheld Devices)
          ========================================================================= */}
      <div className={`${hubStyles.mobileContainer} ${hubStyles.fixedTopicsMobile} ${hubStyles.oledMobile} ${styles.mobileLayout}`}>
        {/* Mobile Topbar */}
        <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${hubStyles.mobileTopbar} ${styles.mobileHeader}`}>
          <Link replace
            href={backHref}
            className={`${hubStyles.mobileBackBtn} ${styles.mobileBackBtn}`}
            aria-label={`Back to ${backLabel}`}
          >
            <ArrowLeft size={18} strokeWidth={2.4} />
          </Link>
          <h1 className={`${hubStyles.mobileTopbarTitle} ${styles.mobileTopbarTitle}`}>
            {group.label} Chapters
          </h1>
          {group.filters.length > 0 ? filterButton : null}
        </header>

        <div data-hub-part="mobileBody" className={hubStyles.mobileBody}>
          {/* Mobile Search Row */}
          <div data-hub-part="mobileSearchRow" className={styles.chapterSearch}>
            <Search size={21} aria-hidden="true" />
            <input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={styles.chapterSearchInput}
              data-custom-focus
              data-mobile-chapter-search
              enterKeyHint="search"
              placeholder={isListening ? "Listening... speak chapter" : `Search ${group.label.toLowerCase()} chapters…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={`Search ${group.label} chapters`}
            />
            <div className={styles.chapterSearchActions}>
              {query && (
                <button data-ui-button="state" data-ui-shape="icon"
                  type="button"
                  className={styles.searchAction}
                  onClick={() => setQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              )}
              <span className={styles.searchDivider} aria-hidden="true" />
              <button data-ui-button="state" data-ui-shape="icon"
                type="button"
                className={styles.searchAction}
                aria-pressed={isListening}
                onClick={toggleVoiceSearch}
                aria-label={isListening ? "Stop voice search" : "Voice search"}
                title={isListening ? "Listening..." : "Voice search"}
              >
                <MicIcon size={16} />
              </button>
            </div>
          </div>

          {/* Flat chapter list with stable rank and unrestricted title wrapping. */}
          <div data-hub-part="mobileTopicGroup" className={styles.chapterList}>
            {topics.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--mac-text-secondary, #8E8E93)", fontSize: "0.9rem" }}>
                No {group.label.toLowerCase()} chapters found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              topics.map((topic) => {
                return (
                  <Link
                    key={topic.slug}
                    href={`${routeBase}/${topic.slug}`}
                    data-hub-part="mobileTopicRow" className={styles.chapterRow}
                    aria-label={`${topic.rank}. ${topic.title}`}
                  >
                      <div className={styles.chapterIcon}>
                        <TopicThumbnail src={chapterImage(topic.slug, group.slug)} size={56} />
                      </div>
                      <span className={styles.mobileRankNum} aria-hidden="true">{topic.rank}.</span>
                      <span className={styles.chapterText}>
                        <span className={styles.mobileTopicName}>{topic.title}</span>
                        <span className={styles.chapterQuestionCount}>
                          {data?.totals?.[topic.slug] ?? 0} Questions
                        </span>
                      </span>
                      <ChevronRight className={styles.chapterChevron} size={20} aria-hidden="true" />
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={filterDialogRef}
        id="chapter-filter-dialog"
        className={styles.filterDialog}
        aria-labelledby="chapter-filter-title"
        onCancel={(event) => { event.preventDefault(); setFilterOpen(false); }}
        onClose={() => setFilterOpen(false)}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) setFilterOpen(false);
        }}
      >
        <div className={styles.filterDialogHeader}>
          <h2 id="chapter-filter-title">Filter chapters</h2>
          <button type="button" data-ui-button="icon" aria-label="Close filters" onClick={() => setFilterOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.filterOptions} aria-label={`Filter by ${group.metricLabel.toLowerCase()}`}>
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              data-ui-button="state"
              className={styles.filterOption}
              aria-pressed={priority === filter}
              onClick={() => { setPriority(filter); setFilterOpen(false); }}
            >
              {filter}
              {priority === filter && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
