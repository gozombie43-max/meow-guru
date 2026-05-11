"use client";

import type { KeyboardEvent } from "react";
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
    id: "algebra-pawan",
    title: "Algebra For SSC/CDS By Pawan Rao Sir",
    channel: "Maths with Pawan Rao",
    type: "Course",
    lessons: 25,
    status: "unwatched",
    href: "/videos/SSC_Pratham_12_StudyWithGuru.html",
    accent: "#ffe100",
    theme: "yellow",
    primary: "ALGEBRA",
    secondary: "Basic To Advance level",
    lessonLabel: "Lesson -1",
    logo: "P",
  },
  {
    id: "quant-algebra",
    title: "ALGEBRA",
    channel: "MBA Wallah",
    type: "Playlist",
    lessons: 10,
    status: "unwatched",
    href: "/videos/STUDY%20WITH%20GURU.html",
    accent: "#f1e83b",
    theme: "green",
    primary: "QUANT ALGEBRA",
    secondary: "EQUATIONS VS EXPRESSIONS",
    lessonLabel: "CAT EXAM",
    logo: "PW",
  },
  {
    id: "ssc-foundation",
    title: "SSC CGL Algebra Complete Foundation",
    channel: "Exam Prep Studio",
    type: "Course",
    lessons: 18,
    status: "watched",
    href: "/videos/SSC%20Pratham.html",
    accent: "#3dd5ff",
    theme: "blue",
    primary: "SSC ALGEBRA",
    secondary: "Identities, Roots & Polynomials",
    lessonLabel: "Foundation batch",
    logo: "EP",
  },
  {
    id: "fast-revision",
    title: "Algebra Fast Revision for CGL Mains",
    channel: "Quant Sprint",
    type: "Playlist",
    lessons: 12,
    status: "unwatched",
    accent: "#c9a7ff",
    theme: "purple",
    primary: "REVISION",
    secondary: "Most repeated algebra questions",
    lessonLabel: "Exam ready",
    logo: "QS",
  },
];

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
    <div className={`playlist-thumb theme-${playlist.theme}`}>
      <div className="playlist-stack stack-back" aria-hidden="true" />
      <div className="playlist-stack stack-one" aria-hidden="true" />
      <div className="playlist-stack stack-two" aria-hidden="true" />
      <div className="thumb-stage">
        <div className="thumb-topline">SSC CGL | CHSL | CPO | MTS | Railway</div>
        <div className="thumb-primary">{playlist.primary}</div>
        <div className="thumb-secondary">{playlist.secondary}</div>
        <div className="thumb-lesson">{playlist.lessonLabel}</div>
        <div className="thumb-person" aria-hidden="true">
          <span />
        </div>
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
        <VideoFilters active={activeFilter} onChange={setActiveFilter} />

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
          min-height: 100vh;
          background: #ffffff;
          color: #0f0f0f;
          font-family: "Outfit", "Roboto", "Helvetica Neue", Arial, sans-serif;
          padding: 12px 12px calc(26px + env(safe-area-inset-bottom));
        }

        .videos-shell {
          width: min(100%, 720px);
          margin: 0 auto;
        }

        .video-filters {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          margin: 0 -12px;
          padding: 8px 12px 10px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
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
          border: 1px solid transparent;
          border-radius: 999px;
          padding: 0 16px;
          background: #f3f4f6;
          color: #0c0c0c;
          font-size: 0.96rem;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          scroll-snap-align: start;
          transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .video-chip.is-active {
          background: #050505;
          color: #ffffff;
        }

        .video-chip:active {
          transform: scale(0.97);
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
          content-visibility: auto;
          contain-intrinsic-size: 280px;
        }

        .playlist-card.is-clickable {
          cursor: pointer;
          outline: none;
        }

        .playlist-card.is-clickable:focus-visible .thumb-stage {
          box-shadow:
            0 0 0 3px #ffffff,
            0 0 0 6px #050505,
            0 18px 34px rgba(15, 23, 42, 0.18),
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
          border: 1px solid rgba(15, 23, 42, 0.13);
          box-shadow:
            0 9px 18px rgba(15, 23, 42, 0.13),
            inset 0 1px 0 rgba(255, 255, 255, 0.72),
            inset 0 -1px 0 rgba(15, 23, 42, 0.08);
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
          background: rgba(15, 23, 42, 0.11);
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
            linear-gradient(90deg, rgba(8, 12, 20, 0.9), rgba(8, 12, 20, 0.72)),
            repeating-linear-gradient(25deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 36px),
            #101820;
          border: 1px solid rgba(15, 23, 42, 0.16);
          box-shadow:
            0 18px 34px rgba(15, 23, 42, 0.18),
            0 4px 0 rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }

        .theme-green .thumb-stage {
          background:
            linear-gradient(90deg, rgba(7, 50, 40, 0.95), rgba(13, 84, 60, 0.72)),
            radial-gradient(circle at 75% 45%, rgba(255, 255, 255, 0.15), transparent 32%),
            #0b3f34;
        }

        .theme-blue .thumb-stage {
          background:
            linear-gradient(90deg, rgba(8, 28, 75, 0.94), rgba(11, 81, 126, 0.78)),
            radial-gradient(circle at 80% 35%, rgba(61, 213, 255, 0.22), transparent 34%),
            #092656;
        }

        .theme-purple .thumb-stage {
          background:
            linear-gradient(90deg, rgba(35, 18, 64, 0.94), rgba(89, 39, 124, 0.76)),
            radial-gradient(circle at 80% 35%, rgba(201, 167, 255, 0.24), transparent 34%),
            #261545;
        }

        .theme-yellow .thumb-stage::before,
        .theme-green .thumb-stage::before,
        .theme-blue .thumb-stage::before,
        .theme-purple .thumb-stage::before {
          content: "";
          position: absolute;
          inset: 22% -8% auto -2%;
          height: 33%;
          transform: skewX(-13deg);
          background: var(--thumb-accent, #ffe100);
          z-index: 1;
        }

        .theme-green .thumb-stage::before {
          --thumb-accent: #ffffff;
          height: 20%;
          top: 7%;
          transform: none;
        }

        .theme-blue .thumb-stage::before {
          --thumb-accent: #3dd5ff;
        }

        .theme-purple .thumb-stage::before {
          --thumb-accent: #c9a7ff;
        }

        .thumb-topline {
          position: absolute;
          z-index: 2;
          top: 6%;
          left: 0;
          right: 0;
          width: max-content;
          max-width: 96%;
          margin: 0 auto;
          padding: 3px 7px;
          border-radius: 999px;
          background: #ffffff;
          color: #050505;
          font-size: clamp(0.62rem, 2.8vw, 1rem);
          line-height: 1.1;
          font-weight: 900;
          white-space: nowrap;
        }

        .thumb-primary {
          position: absolute;
          z-index: 2;
          top: 28%;
          left: 5%;
          max-width: 68%;
          color: #050505;
          font-size: clamp(1.85rem, 10vw, 4.8rem);
          line-height: 0.9;
          font-style: italic;
          font-weight: 900;
          letter-spacing: 0;
        }

        .theme-green .thumb-primary,
        .theme-blue .thumb-primary,
        .theme-purple .thumb-primary {
          top: 9%;
          color: #063650;
          font-size: clamp(1.7rem, 9vw, 4rem);
          font-style: normal;
        }

        .theme-green .thumb-topline {
          display: none;
        }

        .theme-green .thumb-primary {
          left: 7%;
          max-width: 74%;
          font-size: clamp(1.16rem, 6.2vw, 3.1rem);
          line-height: 0.92;
          white-space: nowrap;
        }

        .theme-blue .thumb-primary,
        .theme-purple .thumb-primary {
          color: #ffffff;
        }

        .thumb-secondary {
          position: absolute;
          z-index: 2;
          left: 5%;
          bottom: 26%;
          max-width: 62%;
          color: #ffffff;
          font-size: clamp(0.86rem, 4.3vw, 2.1rem);
          font-weight: 900;
          line-height: 1.08;
          text-shadow: 0 2px 2px rgba(0, 0, 0, 0.45);
        }

        .theme-green .thumb-secondary {
          color: #ffee2d;
          max-width: 58%;
          text-align: center;
          left: 9%;
          bottom: 30%;
        }

        .thumb-lesson {
          position: absolute;
          z-index: 2;
          left: 5%;
          bottom: 8%;
          color: #ffe100;
          font-size: clamp(0.82rem, 4vw, 1.8rem);
          font-weight: 900;
          line-height: 1;
        }

        .theme-green .thumb-lesson {
          color: #ffffff;
          font-size: clamp(1rem, 5vw, 2.3rem);
          letter-spacing: 0.04em;
        }

        .thumb-person {
          position: absolute;
          z-index: 2;
          right: 2%;
          bottom: 0;
          width: 31%;
          height: 74%;
          border-radius: 50% 50% 0 0;
          background:
            radial-gradient(circle at 50% 18%, #d6a57c 0 14%, transparent 15%),
            linear-gradient(#18203b 0 100%);
          clip-path: polygon(22% 20%, 74% 20%, 92% 100%, 8% 100%);
        }

        .theme-green .thumb-person {
          background:
            radial-gradient(circle at 50% 15%, #e1b28e 0 13%, transparent 14%),
            linear-gradient(#262a2f 0 100%);
        }

        .theme-blue .thumb-person {
          background:
            radial-gradient(circle at 50% 15%, #d8a57d 0 13%, transparent 14%),
            linear-gradient(#0c1f43 0 100%);
        }

        .theme-purple .thumb-person {
          background:
            radial-gradient(circle at 50% 15%, #d3a17d 0 13%, transparent 14%),
            linear-gradient(#221833 0 100%);
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
          border-radius: 8px;
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
          border: 2px solid #e5e7eb;
          color: #008080;
          background: #ffffff;
          font-size: 0.78rem;
          font-weight: 900;
          line-height: 1;
          box-shadow: inset 0 0 0 2px rgba(0, 128, 128, 0.12);
        }

        .playlist-copy {
          min-width: 0;
        }

        .playlist-copy h2 {
          margin: 0;
          color: #0f0f0f;
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
          color: #606060;
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
          color: #0b0b0b;
          width: 36px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border-radius: 999px;
        }

        .more-btn:active {
          background: #f3f4f6;
        }

        .empty-state {
          min-height: 220px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 10px;
          color: #606060;
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
