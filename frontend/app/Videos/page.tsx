"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  GraduationCap,
  MoreVertical,
  PlayCircle,
  Sparkles,
} from "lucide-react";

type FilterKey = "all" | "shorts" | "unwatched" | "watched" | "videos";

type Playlist = {
  id: string;
  title: string;
  channel: string;
  type: "Course" | "Playlist";
  lessons: number;
  status: "unwatched" | "watched";
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
          <span>
            {playlist.type} · {playlist.lessons} lessons
          </span>
        </div>
      </div>
    </div>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <article className="playlist-card">
      <PlaylistThumbnail playlist={playlist} />

      <div className="playlist-meta-row">
        <div className="channel-logo">{playlist.logo}</div>
        <div className="playlist-copy">
          <h2>{playlist.title}</h2>
          <p>
            {playlist.channel} · {playlist.type}
          </p>
        </div>
        <button type="button" className="more-btn" aria-label={`More options for ${playlist.title}`}>
          <MoreVertical size={28} strokeWidth={2.8} />
        </button>
      </div>

      <button type="button" className="lesson-row" aria-label={`Open ${playlist.title} lessons`}>
        <span className="lesson-count">{playlist.lessons} videos</span>
        <span className={`mini-thumb theme-${playlist.theme}`} aria-hidden="true">
          <span />
        </span>
        <span className="lesson-title">Algebra With Basics For #SSC_...</span>
        <ChevronDown className="lesson-chevron" size={26} strokeWidth={3} />
      </button>
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

        <button type="button" className="summary-strip">
          <span className="summary-icon" aria-hidden="true">
            <Sparkles size={22} fill="currentColor" />
          </span>
          <span className="summary-title">Summary</span>
          <span className="summary-copy">आदित्य रंजन इस कक्षा में बीजगणित के महत्वपूर्ण...</span>
          <ChevronDown className="summary-chevron" size={30} strokeWidth={3} />
        </button>

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
          padding: 18px 14px 28px;
        }

        .videos-shell {
          width: min(100%, 720px);
          margin: 0 auto;
        }

        .video-filters {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow-x: auto;
          padding: 4px 4px 12px;
          scrollbar-width: none;
        }

        .video-filters::-webkit-scrollbar {
          display: none;
        }

        .video-chip {
          flex: 0 0 auto;
          min-height: 52px;
          border: 0;
          border-radius: 13px;
          padding: 0 22px;
          background: #f2f2f2;
          color: #0c0c0c;
          font-size: clamp(1rem, 4.5vw, 1.25rem);
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }

        .video-chip.is-active {
          background: #050505;
          color: #ffffff;
        }

        .video-chip:active {
          transform: scale(0.97);
        }

        .summary-strip {
          width: 100%;
          display: grid;
          grid-template-columns: auto auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          min-height: 58px;
          border: 0;
          border-radius: 12px;
          padding: 0 16px;
          background: #f7f0f2;
          color: #111111;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .summary-icon {
          display: inline-flex;
          color: #050505;
        }

        .summary-title {
          font-size: clamp(1rem, 4.2vw, 1.22rem);
          font-weight: 800;
          white-space: nowrap;
        }

        .summary-copy {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: clamp(0.95rem, 4vw, 1.13rem);
          font-weight: 500;
        }

        .summary-chevron {
          color: #090909;
        }

        .playlist-list {
          display: flex;
          flex-direction: column;
          gap: 38px;
          padding: 52px 0 18px;
        }

        .playlist-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .playlist-thumb {
          position: relative;
          padding-top: 10px;
        }

        .playlist-stack {
          position: absolute;
          left: 6%;
          right: 6%;
          height: 14px;
          border-radius: 18px 18px 0 0;
          border: 1px solid rgba(15, 23, 42, 0.12);
        }

        .stack-one {
          top: -14px;
          background: #d4e0ef;
        }

        .stack-two {
          top: -6px;
          background: #aebdcc;
        }

        .theme-green .stack-one {
          background: #d5eee4;
        }

        .theme-green .stack-two {
          background: #b9d7ca;
        }

        .theme-blue .stack-one {
          background: #d8ebff;
        }

        .theme-blue .stack-two {
          background: #b8cce6;
        }

        .theme-purple .stack-one {
          background: #eadcff;
        }

        .theme-purple .stack-two {
          background: #d4baf5;
        }

        .thumb-stage {
          position: relative;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 18px;
          background:
            linear-gradient(90deg, rgba(8, 12, 20, 0.9), rgba(8, 12, 20, 0.72)),
            repeating-linear-gradient(25deg, rgba(255, 255, 255, 0.08) 0 1px, transparent 1px 36px),
            #101820;
          border: 1px solid rgba(15, 23, 42, 0.16);
          box-shadow: 0 2px 0 rgba(15, 23, 42, 0.08);
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
          padding: 3px 8px;
          border-radius: 999px;
          background: #ffffff;
          color: #050505;
          font-size: clamp(0.68rem, 3.2vw, 1.2rem);
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
          font-size: clamp(2.15rem, 12vw, 5.4rem);
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
          font-size: clamp(1.45rem, 7.4vw, 3.4rem);
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
          font-size: clamp(1rem, 5.2vw, 2.3rem);
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
          font-size: clamp(0.9rem, 4.8vw, 2rem);
          font-weight: 900;
          line-height: 1;
        }

        .theme-green .thumb-lesson {
          color: #ffffff;
          font-size: clamp(1.25rem, 6vw, 2.5rem);
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
          right: 2%;
          bottom: 4%;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          max-width: 44%;
          border-radius: 9px;
          padding: 8px 10px;
          background: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          font-size: clamp(0.76rem, 3.6vw, 1.1rem);
          font-weight: 800;
          line-height: 1;
          backdrop-filter: blur(4px);
        }

        .playlist-meta-row {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) 34px;
          align-items: start;
          gap: 12px;
          padding: 0 4px;
        }

        .channel-logo {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #e5e7eb;
          color: #008080;
          background: #ffffff;
          font-size: 0.86rem;
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
          font-size: clamp(1.15rem, 5.2vw, 1.65rem);
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: 0;
        }

        .playlist-copy p {
          margin: 6px 0 0;
          color: #606060;
          font-size: clamp(0.92rem, 4.2vw, 1.08rem);
          line-height: 1.2;
          font-weight: 400;
        }

        .more-btn {
          border: 0;
          background: transparent;
          color: #0b0b0b;
          width: 34px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .lesson-row {
          width: 100%;
          min-height: 58px;
          display: grid;
          grid-template-columns: auto 82px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          border: 0;
          border-radius: 12px;
          padding: 8px 14px;
          background: #f4f6fb;
          color: #101010;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .lesson-count {
          font-size: clamp(0.92rem, 4.1vw, 1.05rem);
          font-weight: 500;
          white-space: nowrap;
        }

        .mini-thumb {
          display: block;
          width: 82px;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 3px;
          background: #101820;
          position: relative;
        }

        .mini-thumb::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 28%;
          height: 30%;
          background: #ffe100;
          transform: skewX(-13deg);
        }

        .mini-thumb.theme-green {
          background: #0b3f34;
        }

        .mini-thumb.theme-green::before {
          top: 12%;
          height: 22%;
          background: #ffffff;
          transform: none;
        }

        .mini-thumb.theme-blue {
          background: #092656;
        }

        .mini-thumb.theme-blue::before {
          background: #3dd5ff;
        }

        .mini-thumb.theme-purple {
          background: #261545;
        }

        .mini-thumb.theme-purple::before {
          background: #c9a7ff;
        }

        .lesson-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: clamp(0.98rem, 4.5vw, 1.16rem);
          font-weight: 400;
        }

        .lesson-chevron {
          color: #111111;
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
          }

          .summary-strip {
            min-height: 62px;
          }

          .playlist-list {
            gap: 46px;
            padding-top: 58px;
          }

          .playlist-meta-row {
            grid-template-columns: 54px minmax(0, 1fr) 40px;
          }

          .channel-logo {
            width: 48px;
            height: 48px;
          }
        }

        @media (max-width: 390px) {
          .videos-page {
            padding-left: 10px;
            padding-right: 10px;
          }

          .video-chip {
            padding: 0 17px;
            min-height: 48px;
          }

          .summary-strip {
            gap: 8px;
            padding: 0 12px;
          }

          .playlist-list {
            padding-top: 44px;
            gap: 34px;
          }

          .lesson-row {
            grid-template-columns: auto 66px minmax(0, 1fr) auto;
            gap: 9px;
            padding-left: 10px;
            padding-right: 10px;
          }

          .mini-thumb {
            width: 66px;
          }
        }
      `}</style>
    </main>
  );
}
