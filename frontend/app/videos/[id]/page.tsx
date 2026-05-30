'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookmarkPlus, CheckCircle, Circle, PlayCircle, Search } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';
const HEADER_HEIGHT = 96;

type Video = {
  id: string;
  subject: string;
  topic: string;
  chapter: string;
  blobPath: string;
  duration: string;
  order: number;
  description: string;
};

const SUBJECT_MAP: Record<string, string> = {
  reasoning: 'Reasoning',
  math: 'Mathematics',
  english: 'English',
  general_awareness: 'General Awareness',
};

const lightVideoTheme = {
  pageBg: '#ffffff',
  pageFg: '#0f0f0f',
  headerBg: '#ffffff',
  headerBorder: '#f0f0f0',
  headerShadow: '0 1px 0 rgba(0,0,0,0.06)',
  title: '#0f0f0f',
  muted: '#606060',
  faint: '#888888',
  divider: '#f0f0f0',
  progressTrack: '#f0f0f0',
  progressFill: '#050505',
  buttonBg: '#ffffff',
  buttonBorder: '#e5e7eb',
  buttonFg: '#0f0f0f',
  activeButtonBg: '#050505',
  activeButtonFg: '#ffffff',
  nextBg: '#fafafa',
  chapterBg: '#ffffff',
  chapterSelectedBg: '#f9f9f9',
  selectedBorder: '#0f0f0f',
  indexBg: '#f3f4f6',
  indexFg: '#606060',
  playingBar: '#0f0f0f',
  topicHeader: '#aaaaaa',
  loadingText: '#cccccc',
};

const darkVideoTheme = {
  pageBg: '#0d1117',
  pageFg: '#e6e8eb',
  headerBg: 'rgba(15, 20, 28, 0.94)',
  headerBorder: '#262d37',
  headerShadow: '0 1px 0 rgba(255,255,255,0.06)',
  title: '#f3f4f6',
  muted: '#b6bdc8',
  faint: '#959ead',
  divider: '#262d37',
  progressTrack: '#2c3440',
  progressFill: '#e6e8eb',
  buttonBg: '#1a212b',
  buttonBorder: '#313b48',
  buttonFg: '#e6e8eb',
  activeButtonBg: '#e6e8eb',
  activeButtonFg: '#0d1117',
  nextBg: '#121923',
  chapterBg: '#0d1117',
  chapterSelectedBg: '#1a212b',
  selectedBorder: '#e6e8eb',
  indexBg: '#242d39',
  indexFg: '#c2c8d2',
  playingBar: '#e6e8eb',
  topicHeader: '#8d96a6',
  loadingText: '#a5aebb',
};

async function readApiJson(response: Response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }

  return data;
}

export default function VideoPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useThemeMode();
  const subject = params.id as string;
  const fixedPlayerEnabled = subject === 'reasoning' || subject === 'math';
  const videoTheme = theme === 'dark' ? darkVideoTheme : lightVideoTheme;

  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const filteredVideos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return videos;

    return videos.filter((video) =>
      `${video.chapter} ${video.topic} ${video.description}`.toLowerCase().includes(query)
    );
  }, [searchQuery, videos]);

  // Group by topic
  const grouped = filteredVideos.reduce<Record<string, Video[]>>((acc, v) => {
    if (!acc[v.topic]) acc[v.topic] = [];
    acc[v.topic].push(v);
    return acc;
  }, {});

  const streamVideo = useCallback(async (video: Video) => {
    setSelected(video);
    setVideoUrl(null);
    setLoadingStream(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/videos/stream/${encodeURIComponent(video.id)}`);
      const data = await readApiJson(res);
      if (data.success) setVideoUrl(data.url);
      else setError('Could not load video.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stream error. Try again.');
    } finally {
      setLoadingStream(false);
    }
  }, []);

  const fetchVideos = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/videos?subject=${encodeURIComponent(subject)}`);
      const data = await readApiJson(res);
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos.');
    } finally {
      setLoadingList(false);
    }
  }, [subject]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  function toggleWatched(id: string) {
    setWatched(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const nextVideo = selected
    ? videos[videos.findIndex(v => v.id === selected.id) + 1]
    : null;

  const progress = videos.length ? Math.round((watched.size / videos.length) * 100) : 0;

  return (
    <main style={{
      minHeight: '100vh',
      background: videoTheme.pageBg,
      color: videoTheme.pageFg,
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      fontFamily: '"Outfit", "Roboto", "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 8, padding: '10px 16px 12px', height: HEADER_HEIGHT,
        background: videoTheme.headerBg,
        borderBottom: `1px solid ${videoTheme.headerBorder}`,
        boxShadow: videoTheme.headerShadow,
        backdropFilter: theme === 'dark' ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: theme === 'dark' ? 'blur(16px)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', color: videoTheme.title }}
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: videoTheme.title, lineHeight: 1 }}>
              {SUBJECT_MAP[subject] || subject}
            </div>
            <div style={{ fontSize: 11, color: videoTheme.muted, marginTop: 2 }}>
              {watched.size}/{videos.length} completed
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ width: 80, height: 4, background: videoTheme.progressTrack, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: videoTheme.progressFill, borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          borderRadius: 10, border: `1px solid ${videoTheme.buttonBorder}`,
          background: videoTheme.buttonBg, padding: '7px 10px',
        }}>
          <Search size={16} color={videoTheme.muted} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search videos by name"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: videoTheme.title,
              fontSize: 13,
              fontWeight: 500,
            }}
          />
        </div>
      </div>

        <div aria-hidden style={{ height: HEADER_HEIGHT }} />

      {/* Video player */}
      {fixedPlayerEnabled && <div aria-hidden className="yt-player-spacer" style={{ aspectRatio: '16/9', maxHeight: '56vw' }} />}
      <div
        className={fixedPlayerEnabled ? 'yt-player-shell yt-player-shell-fixed' : 'yt-player-shell'}
        style={{
          position: fixedPlayerEnabled ? 'fixed' : 'relative',
          top: fixedPlayerEnabled ? HEADER_HEIGHT : undefined,
          left: fixedPlayerEnabled ? 0 : undefined,
          right: fixedPlayerEnabled ? 0 : undefined,
          zIndex: fixedPlayerEnabled ? 40 : undefined,
          width: '100%',
          background: '#000',
          aspectRatio: '16/9',
          maxHeight: '56vw',
          boxShadow: fixedPlayerEnabled ? (theme === 'dark' ? '0 8px 20px rgba(0, 0, 0, 0.55)' : '0 8px 20px rgba(15, 23, 42, 0.12)') : undefined,
        }}
      >
        {loadingStream && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050709', zIndex: 2 }}>
            <div style={{ width: 36, height: 36, border: '3px solid #222', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 10 }} />
            <div style={{ fontSize: 12, color: '#666' }}>Loading video...</div>
          </div>
        )}
        {!videoUrl && !loadingStream && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#050709', gap: 10 }}>
            <PlayCircle size={48} color="#333" strokeWidth={1.5} />
            <div style={{ fontSize: 13, color: '#555' }}>Select a chapter</div>
          </div>
        )}
        {videoUrl && (
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            style={{ width: '100%', height: '100%', display: 'block' }}
            onEnded={() => selected && toggleWatched(selected.id)}
          />
        )}
      </div>

      <div className="yt-watch-content">

      {/* Now playing info */}
      {selected && (
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${videoTheme.divider}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: videoTheme.title, lineHeight: 1.3 }}>
            {selected.chapter}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: videoTheme.muted }}>{selected.topic}</span>
            <span style={{ fontSize: 12, color: videoTheme.loadingText }}>·</span>
            <span style={{ fontSize: 12, color: videoTheme.muted }}>⏱ {selected.duration}</span>
          </div>
          {selected.description && (
            <div style={{ fontSize: 13, color: videoTheme.muted, marginTop: 8, lineHeight: 1.6 }}>
              {selected.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => toggleWatched(selected.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${videoTheme.buttonBorder}`,
                background: watched.has(selected.id) ? videoTheme.activeButtonBg : videoTheme.buttonBg,
                color: watched.has(selected.id) ? videoTheme.activeButtonFg : videoTheme.buttonFg,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {watched.has(selected.id)
                ? <><CheckCircle size={15} /> Done</>
                : <><Circle size={15} /> Mark done</>}
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20,
              border: `1px solid ${videoTheme.buttonBorder}`, background: videoTheme.buttonBg,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', color: videoTheme.buttonFg,
            }}>
              <BookmarkPlus size={15} /> Save
            </button>
          </div>
        </div>
      )}

      {/* Next video */}
      {nextVideo && (
        <div
          onClick={() => streamVideo(nextVideo)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', cursor: 'pointer',
            borderBottom: `1px solid ${videoTheme.divider}`,
            background: videoTheme.nextBg,
          }}
        >
          <div style={{ fontSize: 11, color: videoTheme.muted, whiteSpace: 'nowrap' }}>Up next</div>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: videoTheme.progressFill, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PlayCircle size={18} color={theme === 'dark' ? '#000' : '#fff'} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: videoTheme.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nextVideo.chapter}
            </div>
            <div style={{ fontSize: 11, color: videoTheme.muted, marginTop: 2 }}>{nextVideo.duration}</div>
          </div>
        </div>
      )}

      {/* Chapter list */}
      <div style={{ paddingBottom: 90 }}>
        {error && (
          <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
            {error}
          </div>
        )}

        {loadingList ? (
          <div style={{ padding: 32, textAlign: 'center', color: videoTheme.loadingText, fontSize: 13 }}>Loading chapters...</div>
        ) : videos.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: videoTheme.loadingText, fontSize: 13 }}>No videos yet for this subject.</div>
        ) : filteredVideos.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: videoTheme.loadingText, fontSize: 13 }}>No videos found for "{searchQuery}".</div>
        ) : (
          Object.entries(grouped).map(([topic, topicVideos]) => (
            <div key={topic}>
              {/* Topic header */}
              <div style={{ padding: '14px 16px 6px', fontSize: 11, fontWeight: 700, color: videoTheme.topicHeader, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {topic}
              </div>
              {topicVideos.map((v, i) => (
                <div
                  key={v.id}
                  onClick={() => streamVideo(v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', cursor: 'pointer',
                    borderLeft: `3px solid ${selected?.id === v.id ? videoTheme.selectedBorder : 'transparent'}`,
                    background: selected?.id === v.id ? videoTheme.chapterSelectedBg : videoTheme.chapterBg,
                    transition: 'all 0.1s',
                  }}
                >
                  {/* Number or check */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: watched.has(v.id) ? videoTheme.progressFill : videoTheme.indexBg,
                    color: watched.has(v.id) ? (theme === 'dark' ? '#000' : '#fff') : videoTheme.indexFg,
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {watched.has(v.id) ? '✓' : i + 1}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: selected?.id === v.id ? 700 : 500,
                      color: videoTheme.title, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {v.chapter}
                    </div>
                    <div style={{ fontSize: 11, color: videoTheme.faint, marginTop: 2 }}>{v.duration}</div>
                  </div>

                  {/* Playing indicator */}
                  {selected?.id === v.id && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16, flexShrink: 0 }}>
                      {[1, 2, 3].map(n => (
                        <div key={n} style={{
                          width: 3, borderRadius: 2, background: videoTheme.playingBar,
                          height: `${8 + n * 4}px`,
                          animation: `bar${n} 0.8s ease-in-out infinite alternate`,
                          animationDelay: `${n * 0.15}s`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bar1 { from { height: 6px; } to { height: 14px; } }
        @keyframes bar2 { from { height: 10px; } to { height: 18px; } }
        @keyframes bar3 { from { height: 8px; } to { height: 16px; } }
        .yt-player-spacer {
          width: 100%;
          background: transparent;
        }
        .yt-watch-content {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
        }
        .yt-player-shell {
          width: 100%;
          margin: 0 auto;
        }
        .yt-player-shell video {
          background: #000;
        }
        @media (min-width: 1024px) {
          .yt-player-shell-fixed {
            left: 50% !important;
            right: auto !important;
            width: min(100vw - 48px, 980px) !important;
            transform: translateX(-50%);
            border-radius: 12px;
            overflow: hidden;
          }
          .yt-player-spacer {
            max-width: 980px;
            margin: 0 auto;
          }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </main>
  );
}
