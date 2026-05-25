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
    channel: "SSC reasoning video course",
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
  },
  {
    id: "math",
    title: "Math",
    channel: "Quantitative aptitude video course",
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
  },
  {
    id: "english",
    title: "English",
    channel: "English language video course",
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
  },
  {
    id: "general-awareness",
    title: "General Awareness",
    channel: "General awareness video course",
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
  },
  {
    id: "ssc-pratham-11",
    title: "SSC Pratham 11",
    channel: "Rakesh Sir & team videos and notes",
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
    channel: "SSC complete recorded batch",
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
  },
  {
    id: "study-with-guru",
    title: "Study With Guru",
    channel: "Recorded foundation video batch",
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
      <div className="playlist-stack stack-back" aria-hidden="true" />
      <div className="playlist-stack stack-one" aria-hidden="true" />
      <div className="playlist-stack stack-two" aria-hidden="true" />
      <div className="thumb-stage">
        <div className="thumb-icon" aria-hidden="true">
          <SubjectIcon icon={playlist.icon} />
        </div>
        <div className="thumb-topline">{playlist.lessonLabel}</div>
        <div className="thumb-primary">{playlist.primary}</div>
        <div className="thumb-secondary">{playlist.secondary}</div>
        <div className="thumb-lesson">Start learning</div>
        <div className="lesson-badge">
          <GraduationCap size={19} strokeWidth={2.4} />
          <span className="lesson-badge-full">
            {playlist.type} · {playlist.lessons} lessons
          </span>
          <span className="lesson-badge-compact">{playlist.lessons} lessons</span>
        </div>
        <div className="play-affordance" aria-hidden="true">
          <PlayCircle size={38} strokeWidth={2.2} />
        </div>
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
          <h2>{playlist.title}</h2>
          <p>
            {playlist.channel} · {playlist.type}
          </p>
        </div>
        <button
          type="button"
          className="more-btn"
          aria-label={`More options for ${playlist.title}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical size={28} strokeWidth={2.8} />
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
        .videos-page {
          --video-header-height: 60px;
          --video-page-bg: #ffffff;
          --video-page-fg: #0f0f0f;
          --video-filter-bg: rgba(255, 255, 255, 0.94);
          --video-filter-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
          --video-filter-backdrop: none;
          --video-chip-bg: #f3f4f6;
          --video-chip-fg: #0c0c0c;
          --video-chip-border: transparent;
          --video-chip-active-bg: #050505;
          --video-chip-active-fg: #ffffff;
          --video-chip-active-border: transparent;
          --video-chip-press-bg: #f3f4f6;
          --video-chip-active-press-bg: #050505;
          --video-stack-border: rgba(15, 23, 42, 0.13);
          --video-stack-shadow:
            0 9px 18px rgba(15, 23, 42, 0.13),
            inset 0 1px 0 rgba(255, 255, 255, 0.72),
            inset 0 -1px 0 rgba(15, 23, 42, 0.08);
          --video-stack-filter: none;
          --video-stack-divider: rgba(15, 23, 42, 0.11);
          --video-focus-inner: #ffffff;
          --video-focus-outer: #050505;
          --video-focus-shadow: rgba(15, 23, 42, 0.18);
          --video-channel-bg: #ffffff;
          --video-channel-border: #e5e7eb;
          --video-channel-fg: #008080;
          --video-channel-shadow: inset 0 0 0 2px rgba(0, 128, 128, 0.12);
          --video-title-fg: #0f0f0f;
          --video-muted-fg: #606060;
          --video-more-fg: #0b0b0b;
          --video-more-press-bg: #f3f4f6;
          --video-empty-fg: #606060;
          --video-card-bg: transparent;
          --video-card-border: transparent;
          --video-card-shadow: none;
          --video-card-padding: 0;
          --video-card-radius: 0;
          --video-card-hover-bg: transparent;
          --video-thumb-border: rgba(15, 23, 42, 0.16);
          --video-thumb-shadow:
            0 18px 34px rgba(15, 23, 42, 0.18),
            0 4px 0 rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
          min-height: 100vh;
          background: var(--video-page-bg);
          color: var(--video-page-fg);
          font-family: "Outfit", "Roboto", "Helvetica Neue", Arial, sans-serif;
          padding: calc(12px + var(--video-header-height)) 12px
            calc(26px + env(safe-area-inset-bottom));
        }

        body.theme-dark .videos-page {
          --video-page-bg:
            linear-gradient(180deg, #181b20 0%, #111419 44%, #15171b 100%);
          --video-page-fg: #f4f7fb;
          --video-filter-bg: rgba(22, 25, 31, 0.86);
          --video-filter-shadow:
            inset 0 -1px 0 rgba(255, 255, 255, 0.08),
            0 16px 34px rgba(8, 10, 14, 0.32);
          --video-filter-backdrop: blur(18px) saturate(150%);
          --video-chip-bg: rgba(255, 255, 255, 0.075);
          --video-chip-fg: #dce3ea;
          --video-chip-border: rgba(255, 255, 255, 0.08);
          --video-chip-active-bg: linear-gradient(180deg, #f7fafc 0%, #dfe8ef 100%);
          --video-chip-active-fg: #101317;
          --video-chip-active-border: rgba(255, 255, 255, 0.7);
          --video-chip-press-bg: rgba(255, 255, 255, 0.12);
          --video-chip-active-press-bg: #dce5ed;
          --video-stack-border: rgba(198, 213, 226, 0.18);
          --video-stack-shadow:
            0 12px 24px rgba(5, 8, 12, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 -1px 0 rgba(0, 0, 0, 0.32);
          --video-stack-filter: brightness(0.78) saturate(0.98);
          --video-stack-divider: rgba(8, 12, 16, 0.34);
          --video-focus-inner: #15191f;
          --video-focus-outer: #e9f2f7;
          --video-focus-shadow: rgba(6, 9, 14, 0.5);
          --video-channel-bg:
            linear-gradient(180deg, rgba(38, 54, 59, 0.92), rgba(22, 29, 34, 0.92));
          --video-channel-border: rgba(137, 211, 204, 0.22);
          --video-channel-fg: #8bd8c7;
          --video-channel-shadow:
            inset 0 0 0 1px rgba(139, 216, 199, 0.16),
            0 10px 22px rgba(0, 0, 0, 0.24);
          --video-title-fg: #f7fafc;
          --video-muted-fg: #a9b4c0;
          --video-more-fg: #d6dee7;
          --video-more-press-bg: rgba(255, 255, 255, 0.1);
          --video-empty-fg: #a9b4c0;
          --video-card-bg:
            linear-gradient(180deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.026) 100%);
          --video-card-border: rgba(255, 255, 255, 0.075);
          --video-card-shadow:
            0 20px 45px rgba(5, 8, 13, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.055);
          --video-card-padding: 10px;
          --video-card-radius: 20px;
          --video-card-hover-bg:
            linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.035) 100%);
          --video-thumb-border: rgba(207, 223, 234, 0.16);
          --video-thumb-shadow:
            0 24px 48px rgba(4, 8, 13, 0.42),
            0 1px 0 rgba(255, 255, 255, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          color-scheme: dark;
        }

        @media (prefers-color-scheme: dark) {
          body:not(.theme-light) .videos-page {
            --video-page-bg:
              linear-gradient(180deg, #181b20 0%, #111419 44%, #15171b 100%);
            --video-page-fg: #f4f7fb;
            --video-filter-bg: rgba(22, 25, 31, 0.86);
            --video-filter-shadow:
              inset 0 -1px 0 rgba(255, 255, 255, 0.08),
              0 16px 34px rgba(8, 10, 14, 0.32);
            --video-filter-backdrop: blur(18px) saturate(150%);
            --video-chip-bg: rgba(255, 255, 255, 0.075);
            --video-chip-fg: #dce3ea;
            --video-chip-border: rgba(255, 255, 255, 0.08);
            --video-chip-active-bg: linear-gradient(180deg, #f7fafc 0%, #dfe8ef 100%);
            --video-chip-active-fg: #101317;
            --video-chip-active-border: rgba(255, 255, 255, 0.7);
            --video-chip-press-bg: rgba(255, 255, 255, 0.12);
            --video-chip-active-press-bg: #dce5ed;
            --video-stack-border: rgba(198, 213, 226, 0.18);
            --video-stack-shadow:
              0 12px 24px rgba(5, 8, 12, 0.36),
              inset 0 1px 0 rgba(255, 255, 255, 0.18),
              inset 0 -1px 0 rgba(0, 0, 0, 0.32);
            --video-stack-filter: brightness(0.78) saturate(0.98);
            --video-stack-divider: rgba(8, 12, 16, 0.34);
            --video-focus-inner: #15191f;
            --video-focus-outer: #e9f2f7;
            --video-focus-shadow: rgba(6, 9, 14, 0.5);
            --video-channel-bg:
              linear-gradient(180deg, rgba(38, 54, 59, 0.92), rgba(22, 29, 34, 0.92));
            --video-channel-border: rgba(137, 211, 204, 0.22);
            --video-channel-fg: #8bd8c7;
            --video-channel-shadow:
              inset 0 0 0 1px rgba(139, 216, 199, 0.16),
              0 10px 22px rgba(0, 0, 0, 0.24);
            --video-title-fg: #f7fafc;
            --video-muted-fg: #a9b4c0;
            --video-more-fg: #d6dee7;
            --video-more-press-bg: rgba(255, 255, 255, 0.1);
            --video-empty-fg: #a9b4c0;
            --video-card-bg:
              linear-gradient(180deg, rgba(255, 255, 255, 0.055) 0%, rgba(255, 255, 255, 0.026) 100%);
            --video-card-border: rgba(255, 255, 255, 0.075);
            --video-card-shadow:
              0 20px 45px rgba(5, 8, 13, 0.28),
              inset 0 1px 0 rgba(255, 255, 255, 0.055);
            --video-card-padding: 10px;
            --video-card-radius: 20px;
            --video-card-hover-bg:
              linear-gradient(180deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.035) 100%);
            --video-thumb-border: rgba(207, 223, 234, 0.16);
            --video-thumb-shadow:
              0 24px 48px rgba(4, 8, 13, 0.42),
              0 1px 0 rgba(255, 255, 255, 0.06),
              inset 0 1px 0 rgba(255, 255, 255, 0.18);
            color-scheme: dark;
          }
        }

        .videos-shell {
          width: min(100%, 720px);
          margin: 0 auto;
        }

        .videos-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 25;
          height: var(--video-header-height);
          background: var(--video-filter-bg);
          box-shadow: var(--video-filter-shadow);
          backdrop-filter: var(--video-filter-backdrop);
          -webkit-backdrop-filter: var(--video-filter-backdrop);
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
          min-height: 42px;
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
          display: flex;
          flex-direction: column;
          gap: 30px;
          padding: 24px 0 18px;
        }

        .playlist-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: var(--video-card-padding);
          border: 1px solid var(--video-card-border);
          border-radius: var(--video-card-radius);
          background: var(--video-card-bg);
          box-shadow: var(--video-card-shadow);
          content-visibility: auto;
          contain-intrinsic-size: 280px;
          transition:
            background 0.18s ease,
            border-color 0.18s ease,
            transform 0.18s ease;
        }

        .playlist-card.is-clickable {
          cursor: pointer;
          outline: none;
        }

        .playlist-card.is-clickable:hover {
          background: var(--video-card-hover-bg);
        }

        .playlist-card.is-clickable:focus-visible .thumb-stage {
          box-shadow:
            0 0 0 3px var(--video-focus-inner),
            0 0 0 6px var(--video-focus-outer),
            0 18px 34px var(--video-focus-shadow),
            0 4px 0 rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }

        .playlist-thumb {
          position: relative;
          padding-top: 13px;
          isolation: isolate;
        }

        .playlist-stack {
          position: absolute;
          height: 20px;
          border-radius: 14px 14px 6px 6px;
          border: 1px solid var(--video-stack-border);
          box-shadow: var(--video-stack-shadow);
          filter: var(--video-stack-filter);
          transform-origin: center bottom;
          pointer-events: none;
        }

        .playlist-stack::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 4px;
          height: 1px;
          background: var(--video-stack-divider);
          opacity: 0.7;
        }

        .stack-back {
          top: -9px;
          left: 12%;
          right: 12%;
          z-index: 0;
          background: linear-gradient(180deg, #e7eef7 0%, #c8d6e6 100%);
          opacity: 0.74;
          transform: translateY(0) scaleX(0.99);
        }

        .stack-one {
          top: -3px;
          left: 8%;
          right: 8%;
          z-index: 1;
          background: linear-gradient(180deg, #dce7f3 0%, #b7c8da 100%);
          opacity: 0.88;
        }

        .stack-two {
          top: 3px;
          left: 4.5%;
          right: 4.5%;
          z-index: 2;
          background: linear-gradient(180deg, #c9d7e7 0%, #9eb1c5 100%);
        }

        .theme-green .stack-back {
          background: linear-gradient(180deg, #e2f4ec 0%, #c9e2d7 100%);
        }

        .theme-green .stack-one {
          background: linear-gradient(180deg, #d5eee4 0%, #b8d9ca 100%);
        }

        .theme-green .stack-two {
          background: linear-gradient(180deg, #c1e0d3 0%, #99bdad 100%);
        }

        .theme-blue .stack-back {
          background: linear-gradient(180deg, #e4f2ff 0%, #c9dcf2 100%);
        }

        .theme-blue .stack-one {
          background: linear-gradient(180deg, #d8ebff 0%, #b5cce8 100%);
        }

        .theme-blue .stack-two {
          background: linear-gradient(180deg, #c6dbf2 0%, #9db4d0 100%);
        }

        .theme-purple .stack-back {
          background: linear-gradient(180deg, #f1e8ff 0%, #decaf8 100%);
        }

        .theme-purple .stack-one {
          background: linear-gradient(180deg, #eadcff 0%, #d0b3ee 100%);
        }

        .theme-purple .stack-two {
          background: linear-gradient(180deg, #dbc5f8 0%, #b99ce2 100%);
        }

        .thumb-stage {
          position: relative;
          z-index: 3;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 14px;
          background:
            radial-gradient(circle at 83% 18%, rgba(255, 225, 0, 0.22), transparent 28%),
            linear-gradient(135deg, rgba(8, 12, 20, 0.98), rgba(8, 12, 20, 0.78)),
            repeating-linear-gradient(28deg, rgba(255, 255, 255, 0.07) 0 1px, transparent 1px 34px),
            #101820;
          border: 1px solid var(--video-thumb-border);
          box-shadow: var(--video-thumb-shadow);
        }

        .theme-green .thumb-stage {
          background:
            radial-gradient(circle at 82% 18%, rgba(241, 232, 59, 0.22), transparent 30%),
            linear-gradient(135deg, rgba(7, 50, 40, 0.98), rgba(13, 84, 60, 0.78)),
            repeating-linear-gradient(28deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 34px),
            #0b3f34;
        }

        .theme-blue .thumb-stage {
          background:
            radial-gradient(circle at 82% 18%, rgba(61, 213, 255, 0.24), transparent 30%),
            linear-gradient(135deg, rgba(8, 28, 75, 0.96), rgba(11, 81, 126, 0.8)),
            repeating-linear-gradient(28deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 34px),
            #092656;
        }

        .theme-purple .thumb-stage {
          background:
            radial-gradient(circle at 82% 18%, rgba(201, 167, 255, 0.28), transparent 30%),
            linear-gradient(135deg, rgba(35, 18, 64, 0.96), rgba(89, 39, 124, 0.8)),
            repeating-linear-gradient(28deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 34px),
            #261545;
        }

        .theme-yellow .thumb-stage::before,
        .theme-green .thumb-stage::before,
        .theme-blue .thumb-stage::before,
        .theme-purple .thumb-stage::before {
          content: "";
          position: absolute;
          inset: auto -8% 0 -2%;
          height: 42%;
          transform: skewX(-10deg) translateY(22%);
          background: var(--thumb-accent, #ffe100);
          z-index: 1;
        }

        .theme-green .thumb-stage::before {
          height: 42%;
          top: auto;
          transform: skewX(-10deg) translateY(22%);
        }

        .thumb-icon {
          position: absolute;
          z-index: 3;
          right: 6%;
          top: 12%;
          width: clamp(64px, 17vw, 108px);
          height: clamp(64px, 17vw, 108px);
          border-radius: 26px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            0 16px 36px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(8px);
        }

        .thumb-topline {
          position: absolute;
          z-index: 2;
          top: 8%;
          left: 5%;
          max-width: 60%;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(255, 255, 255, 0.18);
          font-size: clamp(0.62rem, 2.5vw, 0.94rem);
          line-height: 1.1;
          font-weight: 900;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .thumb-primary {
          position: absolute;
          z-index: 3;
          top: 30%;
          left: 5%;
          max-width: 70%;
          color: #ffffff;
          font-size: clamp(2.15rem, 10.4vw, 4.9rem);
          line-height: 0.86;
          font-style: normal;
          font-weight: 900;
          letter-spacing: 0;
          text-shadow: 0 3px 14px rgba(0, 0, 0, 0.3);
        }

        .theme-green .thumb-primary {
          color: #ffffff;
          font-size: clamp(2.4rem, 12vw, 5.4rem);
        }

        .playlist-thumb[data-subject="general-awareness"] .thumb-primary {
          max-width: 78%;
          font-size: clamp(1.8rem, 7vw, 3.8rem);
          line-height: 0.94;
        }

        .thumb-secondary {
          position: absolute;
          z-index: 3;
          left: 5%;
          bottom: 21%;
          max-width: 72%;
          color: #ffffff;
          font-size: clamp(0.86rem, 3.9vw, 1.45rem);
          font-weight: 800;
          line-height: 1.16;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.38);
        }

        .thumb-lesson {
          position: absolute;
          z-index: 3;
          left: 5%;
          bottom: 7%;
          color: #050505;
          font-size: clamp(0.78rem, 3.3vw, 1.1rem);
          font-weight: 900;
          line-height: 1;
          border-radius: 999px;
          padding: 7px 10px;
          background: var(--thumb-accent, #ffe100);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.16);
        }

        .lesson-badge {
          position: absolute;
          z-index: 3;
          right: 3%;
          bottom: 4%;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 52%;
          border-radius: 999px;
          padding: 7px 8px;
          background: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          font-size: clamp(0.68rem, 3vw, 1rem);
          font-weight: 800;
          line-height: 1;
          backdrop-filter: blur(4px);
        }

        .lesson-badge span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .lesson-badge-compact {
          display: none;
        }

        .play-affordance {
          position: absolute;
          z-index: 4;
          right: 50%;
          top: 50%;
          transform: translate(50%, -50%);
          width: 54px;
          height: 54px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.42);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.26);
          opacity: 0;
          transition: opacity 0.18s ease, transform 0.18s ease;
          pointer-events: none;
        }

        .playlist-card:active .play-affordance,
        .playlist-card:hover .play-affordance {
          opacity: 1;
          transform: translate(50%, -50%) scale(0.98);
        }

        .playlist-meta-row {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr) 36px;
          align-items: start;
          gap: 10px;
          padding: 0 2px;
        }

        .channel-logo {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--video-channel-border);
          color: var(--video-channel-fg);
          background: var(--video-channel-bg);
          font-size: 0.78rem;
          font-weight: 900;
          line-height: 1;
          box-shadow: var(--video-channel-shadow);
        }

        .playlist-copy {
          min-width: 0;
        }

        .playlist-copy h2 {
          margin: 0;
          color: var(--video-title-fg);
          font-size: clamp(1rem, 4.2vw, 1.45rem);
          font-weight: 600;
          line-height: 1.24;
          letter-spacing: 0;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
        }

        .playlist-copy p {
          margin: 4px 0 0;
          color: var(--video-muted-fg);
          font-size: clamp(0.82rem, 3.5vw, 1.02rem);
          line-height: 1.2;
          font-weight: 400;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .more-btn {
          border: 0;
          background: transparent;
          color: var(--video-more-fg);
          width: 36px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 999px;
        }

        .more-btn:active {
          background: var(--video-more-press-bg);
        }

        .empty-state {
          min-height: 220px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          color: var(--video-empty-fg);
          font-size: 1rem;
        }

        .empty-state p {
          margin: 0;
        }

        @media (min-width: 768px) {
          .videos-page {
            padding-top: 24px;
          }

          .videos-shell {
            max-width: 760px;
          }

          .video-chip {
            min-height: 56px;
            border-radius: 14px;
            padding: 0 22px;
            font-size: 1.18rem;
          }

          .playlist-list {
            gap: 46px;
            padding-top: 48px;
          }

          .playlist-thumb {
            padding-top: 18px;
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
            width: 48px;
            height: 48px;
            font-size: 0.86rem;
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

          .playlist-list {
            padding-top: 22px;
            gap: 28px;
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

      `}</style>
    </main>
  );
}
