"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import {
  Brain,
  Calculator,
  Globe2,
  GraduationCap,
  Languages,
  MoreVertical,
  PlayCircle,
} from "lucide-react";

type FilterKey = "all" | "shorts" | "unwatched" | "watched" | "videos";

type Playlist = {
  id: string;
  title: string;
  channel: string;
  type: "Course" | "Playlist";
  lessons: number;
  status: "unwatched" | "watched";
  href?: string;
  accent: string;
  theme: "yellow" | "green" | "blue" | "purple";
  primary: string;
  secondary: string;

  lessonLabel: string;
  logo: string;
  icon: "reasoning" | "math" | "english" | "general-awareness";
  image?: string;
};

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shorts", label: "Shorts" },
  { key: "unwatched", label: "Unwatched" },
  { key: "watched", label: "Watched" },
  { key: "videos", label: "Videos" },
];

const playlists: Playlist[] = [
  {
    id: "reasoning",
    title: "Reasoning",
    channel: "SSC reasoning",
    type: "Course",
    lessons: 25,
    status: "unwatched",
    href: "/videos/reasoning",
    accent: "#ffe100",
    theme: "yellow",
    primary: "REASONING",
    secondary: "Logic, series, analogy and puzzles",
    lessonLabel: "SSC CGL | CHSL | CPO",
    logo: "R",
    icon: "reasoning",
    image: "/images/reasoning_thumb.jpg",
  },
  {
    id: "math",
    title: "Math",
    channel: "Quantitative aptitude",
    type: "Playlist",
    lessons: 10,
    status: "unwatched",
    href: "/videos/math",
    accent: "#f1e83b",
    theme: "green",
    primary: "MATH",
    secondary: "Arithmetic, algebra and geometry",
    lessonLabel: "Problem solving batch",
    logo: "M",
    icon: "math",
    image: "/images/math_thumb.jpg",
  },
  {
    id: "english",
    title: "English",
    channel: "English language",
    type: "Course",
    lessons: 18,
    status: "watched",
    href: "/videos/english",
    accent: "#3dd5ff",
    theme: "blue",
    primary: "ENGLISH",
    secondary: "Grammar, vocabulary and comprehension",
    lessonLabel: "Foundation batch",
    logo: "E",
    icon: "english",
    image: "/images/english_thumb.jpg",
  },
  {
    id: "general-awareness",
    title: "General Awareness",
    channel: "General awareness",
    type: "Playlist",
    lessons: 12,
    status: "unwatched",
    href: "/videos/general_awareness",
    accent: "#c9a7ff",
    theme: "purple",
    primary: "GENERAL AWARENESS",
    secondary: "GK, current affairs and static facts",
    lessonLabel: "Exam ready",
    logo: "GA",
    icon: "general-awareness",
    image: "/images/ga_thumb.jpg",
  },
  {
    id: "ssc-pratham-11",
    title: "SSC Pratham 11",
    channel: "Rakesh Sir & team",
    type: "Course",
    lessons: 100,
    status: "unwatched",
    href: "/videos/SSC%20Pratham.html",
    accent: "#ffe100",
    theme: "yellow",
    primary: "SSC PRATHAM 11",
    secondary: "Maths, reasoning, English and GS batch",
    lessonLabel: "Recorded batch",
    logo: "P11",
    icon: "reasoning",
  },
  {
    id: "ssc-pratham-12",
    title: "SSC Pratham 12",
    channel: "Recorded batch",
    type: "Course",
    lessons: 100,
    status: "unwatched",
    href: "/videos/SSC_Pratham_12_StudyWithGuru.html",
    accent: "#3dd5ff",
    theme: "blue",
    primary: "SSC PRATHAM 12",
    secondary: "Latest classes, PDFs and exam prep videos",
    lessonLabel: "Study with Guru",
    logo: "P12",
    icon: "general-awareness",
    image: "/images/ga_thumb.jpg",
  },
  {
    id: "study-with-guru",
    title: "Study With Guru",
    channel: "Foundation batch",
    type: "Playlist",
    lessons: 100,
    status: "unwatched",
    href: "/videos/STUDY%20WITH%20GURU.html",
    accent: "#f1e83b",
    theme: "green",
    primary: "STUDY WITH GURU",
    secondary: "Maths foundation and reasoning practice",
    lessonLabel: "Recorded batch",
    logo: "SG",
    icon: "math",
    image: "/images/math_thumb.jpg",
  },
];

function SubjectIcon({ icon }: { icon: Playlist["icon"] }) {
  if (icon === "math") {
    return <Calculator size={48} strokeWidth={2.15} />;
  }

  if (icon === "english") {
    return <Languages size={48} strokeWidth={2.15} />;
  }

  if (icon === "general-awareness") {
    return <Globe2 size={48} strokeWidth={2.15} />;
  }

  return <Brain size={48} strokeWidth={2.15} />;
}

function VideoFilters({
  active,
  onChange,
}: {
  active: FilterKey;
  onChange: (value: FilterKey) => void;
}) {
  return (
    <div className="video-filters" role="tablist" aria-label="Video filters">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className={`video-chip${active === filter.key ? " is-active" : ""}`}
          onClick={() => onChange(filter.key)}
          role="tab"
          aria-selected={active === filter.key}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function PlaylistThumbnail({ playlist }: { playlist: Playlist }) {
  return (
    <div
      className={`playlist-thumb theme-${playlist.theme}`}
      data-subject={playlist.icon}
      style={{ "--thumb-accent": playlist.accent } as CSSProperties}
    >
      <div className="thumb-stage">
        <div className="thumb-icon" aria-hidden="true">
          <SubjectIcon icon={playlist.icon} />
        </div>
      </div>
      <div className="lesson-badge">
        <span className="lesson-badge-compact">{playlist.lessons} videos</span>
      </div>
      <div className="play-affordance" aria-hidden="true">
        <PlayCircle size={32} strokeWidth={2.2} />
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const openPlaylist = () => {
    if (playlist.href) {
      window.location.href = playlist.href;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!playlist.href) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPlaylist();
    }
  };

  return (
    <article
      className={`playlist-card${playlist.href ? " is-clickable" : ""}`}
      onClick={openPlaylist}
      onKeyDown={handleKeyDown}
      tabIndex={playlist.href ? 0 : undefined}
      role={playlist.href ? "link" : undefined}
      aria-label={playlist.href ? `Open ${playlist.title}` : undefined}
    >
      <PlaylistThumbnail playlist={playlist} />

      <div className="playlist-meta-row">
        <div className="channel-logo">{playlist.logo}</div>
        <div className="playlist-copy">
          <h2 title={playlist.title}>{playlist.title}</h2>
          <p title={playlist.channel} className="meta-channel">{playlist.channel}</p>
        </div>
        <button
          type="button"
          className="more-btn"
          aria-label={`More options for ${playlist.title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical size={20} strokeWidth={2.8} />
        </button>
      </div>
    </article>
  );
}

export default function VideosPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const visiblePlaylists = useMemo(() => {
    if (activeFilter === "all" || activeFilter === "videos" || activeFilter === "shorts") {
      return playlists;
    }

    return playlists.filter((playlist) => playlist.status === activeFilter);
  }, [activeFilter]);

  return (
    <main className="videos-page">
      <div className="videos-shell">
        <div className="videos-header">
            <div className="header-top">
              <h1 className="header-title">Videos</h1>
            </div>
            <VideoFilters active={activeFilter} onChange={setActiveFilter} />
          </div>

        <section className="playlist-list" aria-label="Video playlists">
          {visiblePlaylists.length > 0 ? (
            visiblePlaylists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)
          ) : (
            <div className="empty-state">
              <PlayCircle size={42} strokeWidth={1.8} />
              <p>No playlists in this filter yet.</p>
            </div>
          )}
        </section>
      </div>

      <style>{`

        .header-top {
          padding: 16px 20px 8px;
        }

        .header-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: var(--video-page-fg);
          margin: 0;
        }

        .videos-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: var(--video-header-bg, #ffffff);
          backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
          -webkit-backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
          border-bottom: 1px solid var(--video-header-border, transparent);
        }

        body.theme-dark .videos-header {
          --video-header-bg: rgba(0, 0, 0, 0.72);
          --video-header-border: rgba(255, 255, 255, 0.08);
        }

        .video-filters {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          width: min(100%, 720px);
          margin: 0 auto;
          padding: 0 12px;
          scroll-padding-inline: 12px;
          scroll-snap-type: x proximity;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .video-filters::-webkit-scrollbar {
          display: none;
        }

        .video-chip {
            flex: 0 0 auto;
            min-height: 36px;
            font-size: 0.9rem;
          border: 1px solid var(--video-chip-border);
          border-radius: 999px;
          padding: 0 16px;
          background: var(--video-chip-bg);
          color: var(--video-chip-fg);
          font-size: 0.96rem;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          scroll-snap-align: start;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .video-chip.is-active {
          background: var(--video-chip-active-bg);
          color: var(--video-chip-active-fg);
          border-color: var(--video-chip-active-border);
          box-shadow:
            0 10px 22px rgba(4, 8, 12, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.58);
        }

        .video-chip:active {
          background: var(--video-chip-press-bg);
          transform: scale(0.97);
        }

        .video-chip.is-active:active {
          background: var(--video-chip-active-press-bg);
        }

        
        .playlist-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          padding: 24px 10px 18px;
        }

        .playlist-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0;
          background: transparent;
          border: none;
          box-shadow: none;
          border-radius: 0;
        }

        body.theme-dark .playlist-card {
          background: transparent;
          border: none;
        }

        .playlist-thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 12px;
          overflow: hidden;
          background: #333; /* Fallback */
        }
        
        /* Gradients for themes */
        .theme-yellow { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .theme-green { background: linear-gradient(135deg, #10b981, #059669); }
        .theme-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .theme-purple { background: linear-gradient(135deg, #8b5cf6, #6d28d9); }

        .thumb-stage {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          position: relative;
        }

        .thumb-icon {
          color: rgba(255, 255, 255, 0.95);
        }

        .lesson-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(0, 0, 0, 0.75);
          color: #fff;
          font-size: 0.75rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        .play-affordance {
          position: absolute;
          z-index: 4;
          right: 50%;
          top: 50%;
          transform: translate(50%, -50%);
          width: 44px;
          height: 44px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.42);
          opacity: 0;
          transition: opacity 0.18s ease;
          pointer-events: none;
        }

        .playlist-card:hover .play-affordance {
          opacity: 1;
        }

        .playlist-meta-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) 24px;
          gap: 8px;
          align-items: start;
        }

        .channel-logo {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #475569;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 0.7rem;
          font-weight: bold;
          margin-top: 2px;
        }

        .playlist-copy {
          min-width: 0;
        }

        .playlist-copy h2 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          line-height: 1.2;
          color: var(--video-title-fg);
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .meta-primary, .meta-channel {
          margin: 2px 0 0;
          font-size: 0.8rem;
          color: var(--video-muted-fg);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .more-btn {
          background: transparent;
          border: none;
          color: var(--video-more-fg);
          cursor: pointer;
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 2px 0;
        }

        .empty-state { min-height: 220px; display: grid; place-items: center; color: var(--video-empty-fg); }
        .empty-state p { margin: 0; }

        @media (min-width: 768px) {
          .videos-page {
            padding-top: 24px;
          }

          .videos-shell {
            max-width: 760px;
          }

          .video-chip {
              min-height: 40px;
              border-radius: 14px;
              padding: 0 16px;
              font-size: 0.95rem;
            }

            .playlist-list {
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 24px;
              padding-top: 48px;
            }

          .playlist-stack {
            height: 26px;
            border-radius: 18px 18px 7px 7px;
          }

          .stack-back {
            top: -13px;
          }

          .stack-one {
            top: -5px;
          }

          .thumb-stage {
            border-radius: 18px;
          }

          .playlist-meta-row {
            grid-template-columns: 54px minmax(0, 1fr) 40px;
            gap: 12px;
            padding: 0 4px;
          }

          .channel-logo {
              width: 36px;
              height: 36px;
              font-size: 0.75rem;
            }

          .play-affordance {
            width: 64px;
            height: 64px;
          }
        }

        @media (max-width: 540px) {
          .videos-page {
            min-height: calc(100vh - 76px);
          }

          .lesson-badge svg {
            width: 16px;
            height: 16px;
          }

          .more-btn svg {
            width: 24px;
            height: 24px;
          }

          .lesson-badge-full {
            display: none;
          }

          .lesson-badge-compact {
            display: inline;
          }
        }

        @media (max-width: 390px) {
          .videos-page {
            padding-left: 10px;
            padding-right: 10px;
          }

          .video-filters {
            margin-left: -10px;
            margin-right: -10px;
            padding-left: 10px;
            padding-right: 10px;
          }

          .video-chip {
            padding: 0 14px;
            min-height: 40px;
            font-size: 0.9rem;
          }

          .thumb-primary {
            font-size: clamp(1.58rem, 9vw, 3rem);
          }

          .theme-green .thumb-primary {
            font-size: clamp(1rem, 5.7vw, 2.4rem);
          }

          .playlist-thumb[data-subject="general-awareness"] .thumb-primary {
            font-size: clamp(1.45rem, 6.4vw, 2.6rem);
          }

          

          .playlist-meta-row {
            grid-template-columns: 38px minmax(0, 1fr) 34px;
            gap: 8px;
          }

          .channel-logo {
            width: 36px;
            height: 36px;
          }

          .lesson-badge {
            max-width: 54%;
            padding: 6px 7px;
          }
            }

          .play-affordance {
            width: 64px;
            height: 64px;
          }
        }

        @media (max-width: 540px) {
          .videos-page {
            min-height: calc(100vh - 76px);
          }

          .lesson-badge svg {
            width: 16px;
            height: 16px;
          }

          .more-btn svg {
            width: 24px;
            height: 24px;
          }

          .lesson-badge-full {
            display: none;
          }

          .lesson-badge-compact {
            display: inline;
          }
        }

        @media (max-width: 390px) {
          .videos-page {
            padding-left: 10px;
            padding-right: 10px;
          }

          .video-filters {
            margin-left: -10px;
            margin-right: -10px;
            padding-left: 10px;
            padding-right: 10px;
          }

          .video-chip {
            padding: 0 14px;
            min-height: 40px;
            font-size: 0.9rem;
          }

          .thumb-primary {
            font-size: clamp(1.58rem, 9vw, 3rem);
          }

          .theme-green .thumb-primary {
            font-size: clamp(1rem, 5.7vw, 2.4rem);
          }

          .playlist-thumb[data-subject="general-awareness"] .thumb-primary {
            font-size: clamp(1.45rem, 6.4vw, 2.6rem);
          }

          

          .playlist-meta-row {
            grid-template-columns: 38px minmax(0, 1fr) 34px;
            gap: 8px;
          }

          .channel-logo {
            width: 36px;
            height: 36px;
          }

          .lesson-badge {
            max-width: 54%;
            padding: 6px 7px;
          }

          .play-affordance {
            width: 46px;
            height: 46px;
          }
        }

        body.theme-dark {
          background: #000000;
        }

        body.theme-dark .videos-page {
          --video-page-bg: #000000;
          --video-page-fg: #ffffff;
          --video-title-fg: #ffffff;
          --video-muted-fg: rgba(235, 235, 245, 0.6);
          --video-more-fg: #ffffff;
          --video-empty-fg: rgba(235, 235, 245, 0.6);
          --video-filter-bg: rgba(0, 0, 0, 0.72);
          --video-filter-shadow: none;
          --video-filter-backdrop: blur(20px) saturate(180%);
          --video-chip-bg: rgba(255, 255, 255, 0.08);
          --video-chip-fg: rgba(235, 235, 245, 0.6);
          --video-chip-border: rgba(255, 255, 255, 0.08);
          --video-chip-active-bg: #ffffff;
          --video-chip-active-fg: #000000;
          --video-chip-active-border: #ffffff;
          --video-chip-press-bg: rgba(255, 255, 255, 0.12);
          --video-chip-active-press-bg: #e5e5ea;
        }

        body.theme-dark .playlist-card {
          background: transparent;
          border: none;
        }

        body.theme-dark .channel-logo {
          background: #2c2c2e;
          color: #fff;
        }

      `}</style>
    </main>
  );
}
