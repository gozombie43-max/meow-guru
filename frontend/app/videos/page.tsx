"use client";

import type { CSSProperties, KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import {
  GraduationCap,
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
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%" style={{ maxHeight: '100px', maxWidth: '100px' }}>
      <linearGradient id="-x78YR_vzjNg1cy7pYFfQa" x1="16" x2="16" y1="4.905" y2="27.01" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#00b5f0"/><stop offset="1" stopColor="#008cc7"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQa)" d="M26,27H6c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h4.027c0.623,0,1.22,0.247,1.66,0.688	l0.624,0.624C12.753,6.753,13.35,7,13.973,7H26c1.105,0,2,0.895,2,2v16C28,26.105,27.105,27,26,27z"/><linearGradient id="-x78YR_vzjNg1cy7pYFfQb" x1="16" x2="16" y1="5" y2="27" gradientUnits="userSpaceOnUse"><stop offset="0" stopOpacity=".02"/><stop offset="1" stopOpacity=".15"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQb)" d="M26,7H13.973	c-0.623,0-1.22-0.247-1.66-0.688l-0.625-0.625C11.247,5.247,10.65,5,10.027,5H6C4.895,5,4,5.895,4,7v18c0,1.105,0.895,2,2,2h20	c1.105,0,2-0.895,2-2V9C28,7.895,27.105,7,26,7z M27.75,25c0,0.965-0.785,1.75-1.75,1.75H6c-0.965,0-1.75-0.785-1.75-1.75V7	c0-0.965,0.785-1.75,1.75-1.75h4.027c0.56,0,1.087,0.218,1.484,0.615l0.625,0.625c0.491,0.491,1.143,0.761,1.837,0.761H26	c0.965,0,1.75,0.785,1.75,1.75V25z"/><linearGradient id="-x78YR_vzjNg1cy7pYFfQc" x1="16" x2="16" y1="8.922" y2="27.008" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#00dcff"/><stop offset=".859" stopColor="#00bfff"/><stop offset="1" stopColor="#00a8e0"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQc)" d="M27,27H5c-1.105,0-2-0.895-2-2V11	c0-1.105,0.895-2,2-2h22c1.105,0,2,0.895,2,2v14C29,26.105,28.105,27,27,27z"/><linearGradient id="-x78YR_vzjNg1cy7pYFfQd" x1="16" x2="16" y1="9" y2="27" gradientUnits="userSpaceOnUse"><stop offset="0" stopOpacity=".02"/><stop offset="1" stopOpacity=".15"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQd)" d="M27,9H5c-1.105,0-2,0.895-2,2v14	c0,1.105,0.895,2,2,2h22c1.105,0,2-0.895,2-2V11C29,9.895,28.105,9,27,9z M28.75,25c0,0.965-0.785,1.75-1.75,1.75H5	c-0.965,0-1.75-0.785-1.75-1.75V11c0-0.965,0.785-1.75,1.75-1.75h22c0.965,0,1.75,0.785,1.75,1.75V25z"/><g opacity=".2"><linearGradient id="-x78YR_vzjNg1cy7pYFfQe" x1="17.208" x2="17.208" y1="13.134" y2="22.866" gradientUnits="userSpaceOnUse"><stop offset="0" stopOpacity=".1"/><stop offset="1" stopOpacity=".7"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQe)" d="M13.552,13.135 c-0.442,0-0.802,0.36-0.802,0.802v8.128c0,0.442,0.36,0.802,0.802,0.802c0.134,0,0.269-0.035,0.388-0.102l7.315-4.064 c0.258-0.143,0.412-0.405,0.412-0.7c0-0.295-0.154-0.557-0.412-0.7l-7.315-4.064C13.82,13.17,13.686,13.135,13.552,13.135 L13.552,13.135z"/></g><path fill="#fff" d="M21.133,17.518l-7.315-4.064C13.451,13.251,13,13.516,13,13.936v8.128	c0,0.42,0.451,0.686,0.818,0.482l7.315-4.064C21.511,18.272,21.511,17.728,21.133,17.518z"/><linearGradient id="-x78YR_vzjNg1cy7pYFfQf" x1="16" x2="16" y1="10.94" y2="25.154" gradientUnits="userSpaceOnUse"><stop offset=".001" stopOpacity=".1"/><stop offset="1" stopOpacity=".15"/></linearGradient><path fill="url(#-x78YR_vzjNg1cy7pYFfQf)" d="M26.5,25h-1c-0.276,0-0.5-0.224-0.5-0.5v-1	c0-0.276,0.224-0.5,0.5-0.5h1c0.276,0,0.5,0.224,0.5,0.5v1C27,24.776,26.776,25,26.5,25z M27,20.5v-1c0-0.276-0.224-0.5-0.5-0.5h-1	c-0.276,0-0.5,0.224-0.5,0.5v1c0,0.276,0.224,0.5,0.5,0.5h1C26.776,21,27,20.776,27,20.5z M27,16.5v-1c0-0.276-0.224-0.5-0.5-0.5h-1	c-0.276,0-0.5,0.224-0.5,0.5v1c0,0.276,0.224,0.5,0.5,0.5h1C26.776,17,27,16.776,27,16.5z M27,12.5v-1c0-0.276-0.224-0.5-0.5-0.5h-1	c-0.276,0-0.5,0.224-0.5,0.5v1c0,0.276,0.224,0.5,0.5,0.5h1C26.776,13,27,12.776,27,12.5z M7,24.5v-1C7,23.224,6.776,23,6.5,23h-1	C5.224,23,5,23.224,5,23.5v1C5,24.776,5.224,25,5.5,25h1C6.776,25,7,24.776,7,24.5z M7,20.5v-1C7,19.224,6.776,19,6.5,19h-1	C5.224,19,5,19.224,5,19.5v1C5,20.776,5.224,21,5.5,21h1C6.776,21,7,20.776,7,20.5z M7,16.5v-1C7,15.224,6.776,15,6.5,15h-1	C5.224,15,5,15.224,5,15.5v1C5,16.776,5.224,17,5.5,17h1C6.776,17,7,16.776,7,16.5z M7,12.5v-1C7,11.224,6.776,11,6.5,11h-1	C5.224,11,5,11.224,5,11.5v1C5,12.776,5.224,13,5.5,13h1C6.776,13,7,12.776,7,12.5z"/>
    </svg>
  );
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
      <div className="macos-window">
        {/* Desktop Sidebar / Mobile Header */}
        <aside className="macos-sidebar">
          <div className="macos-traffic-lights">
            <div className="traffic-light close"></div>
            <div className="traffic-light minimize"></div>
            <div className="traffic-light maximize"></div>
          </div>
          
          <div className="sidebar-content">
            <h2 className="sidebar-title">Library</h2>
            <VideoFilters active={activeFilter} onChange={setActiveFilter} />
          </div>
        </aside>

        {/* Main scrollable content */}
        <div className="macos-content">
          <div className="videos-header-mobile">
            <h1 className="header-title">Videos</h1>
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

        body.theme-dark .videos-header,
        body.theme-dark .macos-sidebar {
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
          background: transparent;
        }
        
        /* Gradients for themes */
        .theme-yellow { background: transparent; }
        .theme-green { background: transparent; }
        .theme-blue { background: transparent; }
        .theme-purple { background: transparent; }

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
            min-height: calc(100dvh - 76px);
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
            min-height: calc(100dvh - 76px);
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

      

        /* --- macOS Window Styles --- */
        .videos-page {
          min-height: 100dvh;
          background: var(--video-page-bg, #f5f5f7);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .videos-header-mobile {
          display: none;
        }

        .macos-window {
          display: flex;
          width: 100%;
          height: 100dvh;
          background: transparent;
        }

        .macos-sidebar {
          display: flex;
          flex-direction: column;
        }

        .macos-traffic-lights {
          display: none;
        }

        .macos-content {
          flex: 1;
          overflow-y: auto;
          background: var(--video-page-bg, #f5f5f7);
        }

        .sidebar-title {
          display: none;
        }

        @media (max-width: 767px) {
          .macos-window {
            flex-direction: column;
          }
          .macos-sidebar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: var(--video-header-bg, #ffffff);
            backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
            -webkit-backdrop-filter: var(--video-filter-backdrop, saturate(180%) blur(20px));
            border-bottom: 1px solid var(--video-header-border, transparent);
            padding: 16px 0 8px;
          }
          .videos-header-mobile {
            display: block;
            padding: 16px 20px 0;
          }
          .videos-header-mobile .header-title {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: var(--video-page-fg);
            margin: 0;
          }
          .sidebar-content {
             display: flex;
             align-items: center;
          }
        }

        @media (min-width: 768px) {
          .videos-page {
            padding: 40px;
            background: url('https://images.unsplash.com/photo-1604871000636-074fa5117945?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100dvh;
          }

          body.theme-dark .videos-page {
            background: url('https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2940&auto=format&fit=crop') no-repeat center center / cover;
          }

          .macos-window {
            max-width: 1200px;
            width: 100%;
            height: calc(100dvh - 80px);
            max-height: 800px;
            background: var(--macos-window-bg, rgba(255, 255, 255, 0.8));
            backdrop-filter: blur(40px) saturate(150%);
            -webkit-backdrop-filter: blur(40px) saturate(150%);
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255,255,255,0.2) inset;
            overflow: hidden;
            display: flex;
            flex-direction: row;
          }

          body.theme-dark .macos-window {
            --macos-window-bg: rgba(30, 30, 30, 0.75);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1) inset;
          }

          .macos-sidebar {
            width: 240px;
            background: var(--macos-sidebar-bg, rgba(245, 245, 247, 0.5));
            border-right: 1px solid var(--macos-border, rgba(0,0,0,0.1));
            display: flex;
            flex-direction: column;
            padding: 16px 12px;
          }

          body.theme-dark .macos-sidebar {
            --macos-sidebar-bg: rgba(40, 40, 40, 0.5);
            --macos-border: rgba(255,255,255,0.1);
          }

          .macos-traffic-lights {
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
            padding-left: 8px;
          }

          .traffic-light {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }

          .traffic-light.close { background: #ff5f56; border: 1px solid #e0443e; }
          .traffic-light.minimize { background: #ffbd2e; border: 1px solid #dea123; }
          .traffic-light.maximize { background: #27c93f; border: 1px solid #1aab29; }

          .sidebar-title {
            display: block;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--video-muted-fg);
            margin: 0 0 8px 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .macos-content {
            flex: 1;
            padding: 32px;
            background: transparent;
            overflow-y: auto;
          }

          .videos-header-mobile {
            display: block;
            margin-bottom: 24px;
          }

          .videos-header-mobile .header-title {
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: var(--video-page-fg);
            margin: 0;
          }

          .video-filters {
            flex-direction: column;
            align-items: stretch;
            width: 100%;
            padding: 0;
            gap: 4px;
            overflow: visible;
          }

          .video-chip {
            text-align: left;
            padding: 8px 12px;
            border-radius: 6px;
            min-height: 0;
            background: transparent;
            border: none;
            box-shadow: none;
            font-weight: 500;
            font-size: 0.95rem;
          }

          .video-chip.is-active {
            background: var(--macos-active-bg, rgba(0, 0, 0, 0.08));
            color: var(--video-page-fg);
            box-shadow: none;
          }

          body.theme-dark .video-chip.is-active {
            --macos-active-bg: rgba(255, 255, 255, 0.15);
          }

          .playlist-list {
            padding: 0;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 24px;
          }
        }


        :global(.macos-content::-webkit-scrollbar) {
          width: 12px;
        }
        :global(.macos-content::-webkit-scrollbar-track) {
          background: transparent;
        }
        :global(.macos-content::-webkit-scrollbar-thumb) {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        :global(body.theme-dark .macos-content::-webkit-scrollbar-thumb) {
          background-color: rgba(255, 255, 255, 0.25);
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        :global(.macos-content::-webkit-scrollbar-thumb:hover) {
          background-color: rgba(0, 0, 0, 0.35);
          border-width: 2px;
        }
        :global(body.theme-dark .macos-content::-webkit-scrollbar-thumb:hover) {
          background-color: rgba(255, 255, 255, 0.4);
          border-width: 2px;
        }

      `}</style>
    </main>
  );
}
