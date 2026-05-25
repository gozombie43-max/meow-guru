'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookmarkPlus, CheckCircle, Circle, PlayCircle } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

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
  pageBg: '#000000',
  pageFg: '#ffffff',
  headerBg: 'rgba(0, 0, 0, 0.92)',
  headerBorder: '#1f1f23',
  headerShadow: '0 1px 0 rgba(255,255,255,0.08)',
  title: '#ffffff',
  muted: 'rgba(235, 235, 245, 0.62)',
  faint: 'rgba(235, 235, 245, 0.48)',
  divider: '#1f1f23',
  progressTrack: '#2c2c2e',
  progressFill: '#ffffff',
  buttonBg: '#151517',
  buttonBorder: '#2c2c2e',
  buttonFg: '#ffffff',
  activeButtonBg: '#ffffff',
  activeButtonFg: '#000000',
  nextBg: '#111113',
  chapterBg: '#000000',
  chapterSelectedBg: '#151517',
  selectedBorder: '#ffffff',
  indexBg: '#1c1c1e',
  indexFg: 'rgba(235, 235, 245, 0.62)',
  playingBar: '#ffffff',
  topicHeader: 'rgba(235, 235, 245, 0.42)',
  loadingText: 'rgba(235, 235, 245, 0.5)',
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
  const videoTheme = theme === 'dark' ? darkVideoTheme : lightVideoTheme;

  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Group by topic
  const grouped = videos.reduce<Record<string, Video[]>>((acc, v) => {
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
        if (data.videos.length > 0) {
          streamVideo(data.videos[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos.');
    } finally {
      setLoadingList(false);
    }
  }, [streamVideo, subject]);

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
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 52,
        background: videoTheme.headerBg,
        borderBottom: `1px solid ${videoTheme.headerBorder}`,
        boxShadow: videoTheme.headerShadow,
        backdropFilter: theme === 'dark' ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: theme === 'dark' ? 'blur(16px)' : 'none',
      }}>
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

      {/* Video player */}
      <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9', maxHeight: '56vw' }}>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bar1 { from { height: 6px; } to { height: 14px; } }
        @keyframes bar2 { from { height: 10px; } to { height: 18px; } }
        @keyframes bar3 { from { height: 8px; } to { height: 16px; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>
    </main>
  );
}
