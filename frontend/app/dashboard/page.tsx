'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { Inter } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { Bookmark, Brain, History, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import BrainScanDashboard from '@/components/BrainScanDashboard';
import { useAuth } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

type TabKey = 'math' | 'eng' | 'reasoning' | 'ga';
type NavKey = 'recent' | 'bookmark' | 'brain';

type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type RecentQuizEntry = NonNullable<AuthUser['recentQuizzes']>[number];
type BookmarkEntry = NonNullable<AuthUser['bookmarkEntries']>[number];

const TOP_TABS: { label: string; value: TabKey }[] = [
  { label: 'MATH', value: 'math' },
  { label: 'ENG', value: 'eng' },
  { label: 'REASONING', value: 'reasoning' },
  { label: 'GA', value: 'ga' },
];

const SECTION_NAV = [
  { label: 'Recent Quiz', value: 'recent', icon: History },
  { label: 'Bookmark', value: 'bookmark', icon: Bookmark },
  { label: 'Brain Scan', value: 'brain', icon: Brain },
] as const;

const SUBJECT_BY_TAB: Record<TabKey, string> = {
  math: 'mathematics',
  eng: 'english',
  reasoning: 'reasoning',
  ga: 'general-awareness',
};

const TAB_BY_SUBJECT: Record<string, TabKey> = {
  mathematics: 'math',
  english: 'eng',
  reasoning: 'reasoning',
  'general-awareness': 'ga',
};

const GRADIENTS = [
  'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
  'linear-gradient(135deg, #f472b6 0%, #db2777)',
  'linear-gradient(135deg, #34d399 0%, #059669)',
  'linear-gradient(135deg, #fbbf24 0%, #d97706)',
  'linear-gradient(135deg, #60a5fa 0%, #2563eb)',
  'linear-gradient(135deg, #a78bfa 0%, #7c3aed)',
  'linear-gradient(135deg, #f87171 0%, #dc2626)',
  'linear-gradient(135deg, #2dd4bf 0%, #0d9488)',
  'linear-gradient(135deg, #fb923c 0%, #ea580c)',
  'linear-gradient(135deg, #e879f9 0%, #c026d3)',
];

function formatTimeLabel(iso?: string) {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';

  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === today) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function appendQuery(
  base: string,
  params: Record<string, string | number | undefined>
) {
  const [path, rawQuery] = base.split('?');
  const query = new URLSearchParams(rawQuery || '');
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<TabKey | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>('recent');
  const userRecentQuizzes = user?.recentQuizzes;
  const userBookmarkEntries = user?.bookmarkEntries;
  const userBookmarks = user?.bookmarks;

  const recentQuizzes = useMemo<RecentQuizEntry[]>(() => {
    if (!userRecentQuizzes) return [];
    return [...userRecentQuizzes]
      .filter((entry) => entry && entry.quizKey)
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      });
  }, [userRecentQuizzes]);

  const bookmarkEntries = useMemo<BookmarkEntry[]>(() => {
    if (userBookmarkEntries?.length) {
      return [...userBookmarkEntries]
        .filter((entry) => entry && entry.questionId)
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt || '') || 0;
          const bTime = Date.parse(b.updatedAt || '') || 0;
          return bTime - aTime;
        });
    }

    return (userBookmarks || []).map<BookmarkEntry>((id) => ({
      questionId: id,
      title: 'Saved Question',
      subject: undefined,
      updatedAt: undefined,
    }));
  }, [userBookmarkEntries, userBookmarks]);

  const inferredTab = useMemo<TabKey>(() => {
    const nextSubject =
      recentQuizzes[0]?.subject || bookmarkEntries[0]?.subject || 'mathematics';
    return TAB_BY_SUBJECT[nextSubject] || 'math';
  }, [bookmarkEntries, recentQuizzes]);

  const activeTab = selectedTab ?? inferredTab;

  useEffect(() => {
    let animationFrameId: number;
    
    // Cache the query so we don't scan the DOM on every mouse move
    const blobs = Array.from(document.querySelectorAll<HTMLElement>('.dashboard-shell .blob'));

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      // Throttle mouse moves to the next screen refresh
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      animationFrameId = requestAnimationFrame(() => {
        const clientX = event.clientX;
        const clientY = event.clientY;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        blobs.forEach((blob, index) => {
          const speed = (index + 1) * 20;
          const xOffset = (centerX - clientX) / speed;
          const yOffset = (centerY - clientY) / speed;
          blob.style.setProperty('--blob-x', `${xOffset}px`);
          blob.style.setProperty('--blob-y', `${yOffset}px`);
        });
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleCardClick: MouseEventHandler<HTMLElement> = (event) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'dashboard-ripple';
    ripple.style.left = `${event.clientX - rect.left - 50}px`;
    ripple.style.top = `${event.clientY - rect.top - 50}px`;
    card.appendChild(ripple);

    window.setTimeout(() => ripple.remove(), 600);
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const subjectFilter = SUBJECT_BY_TAB[activeTab];
  const filteredRecent = useMemo(
    () => recentQuizzes.filter((entry) => entry.subject === subjectFilter),
    [recentQuizzes, subjectFilter]
  );
  const filteredBookmarks = useMemo(
    () =>
      bookmarkEntries.filter(
        (entry) => !entry.subject || entry.subject === subjectFilter
      ),
    [bookmarkEntries, subjectFilter]
  );

  const emptyCopy =
    activeNav === 'recent'
      ? 'No recent quizzes yet. Start one to see it here.'
      : activeNav === 'bookmark'
        ? 'No bookmarks yet. Save a question to revisit it later.'
        : '';
  const sectionLabel =
    activeNav === 'recent'
      ? 'Recent Quiz'
      : activeNav === 'bookmark'
        ? 'Bookmarks'
        : 'Brain Scan';
  const recentList = filteredRecent;
  const bookmarkList = filteredBookmarks;

  return (
    <main className={`dashboard-shell relative ${inter.className}`}>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="dashboard-frame relative z-10 mx-auto max-w-md">
        <div className="dashboard-top">
          <div className="section-switcher" role="tablist" aria-label="Dashboard sections">
            {SECTION_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`section-pill ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveNav(item.value)}
                >
                  <Icon className="section-pill-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <button
            className="close-btn"
            type="button"
            aria-label="Close dashboard"
            onClick={handleClose}
          >
            <X aria-hidden="true" size={18} strokeWidth={2.4} />
          </button>

          {activeNav !== 'brain' && (
            <div className="nav-container">
              <div className="subject-tabs">
                {TOP_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setSelectedTab(tab.value)}
                    className={`nav-tab ${
                      activeTab === tab.value ? 'active' : ''
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-scroll">
          <div key={`${activeTab}-${activeNav}`} className="page-content">
            <div className="section-label">{sectionLabel}</div>
            {activeNav === 'brain' ? (
              user?.id ? (
                <div className="brain-scan-card">
                  <BrainScanDashboard userId={user.id} />
                </div>
              ) : (
                <div className="glass-card empty-state">
                  Sign in to view your Brain Scan insights.
                </div>
              )
            ) : authLoading ? (
              <div className="dashboard-card-skeletons" aria-busy="true" aria-label="Loading dashboard cards">
                <span className="sr-only" role="status">Loading dashboard cards</span>
                <div className="glass-card dashboard-card-skeleton" aria-hidden="true" />
                <div className="glass-card dashboard-card-skeleton" aria-hidden="true" />
                <div className="glass-card dashboard-card-skeleton" aria-hidden="true" />
              </div>
            ) : activeNav === 'recent' ? (
              recentList.length === 0 ? (
                <div className="glass-card empty-state">{emptyCopy}</div>
              ) : (
                recentList.map((entry, index) => {
                  const gradient = GRADIENTS[index % GRADIENTS.length];
                  const icon =
                    (entry.title || entry.subject || 'Q').trim().charAt(0) || 'Q';
                  const timeLabel = formatTimeLabel(entry.updatedAt);
                  const resumeHref = appendQuery(entry.href, {
                    mode: entry.mode,
                    resume: 1,
                  });
                  const total = entry.totalQuestions ?? 0;
                  const current = entry.currentIndex ?? 0;
                  const progressLabel =
                    total > 0
                      ? `Q${Math.min(current + 1, total)} of ${total}`
                      : 'Continue where you left off';
                  const subtitle =
                    entry.status === 'completed' ? 'Completed' : progressLabel;

                  return (
                    <Link
                      key={entry.quizKey}
                      href={resumeHref}
                      className="glass-card activity-item"
                      onClick={handleCardClick}
                    >
                      <div
                        className="activity-icon"
                        style={{ background: gradient }}
                      >
                        {icon.toUpperCase()}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">{entry.title}</div>
                        <div className="activity-subtitle">{subtitle}</div>
                      </div>
                      <div className="activity-time">{timeLabel}</div>
                    </Link>
                  );
                })
              )
            ) : bookmarkList.length === 0 ? (
              <div className="glass-card empty-state">{emptyCopy}</div>
            ) : (
              bookmarkList.map((entry, index) => {
                const gradient = GRADIENTS[index % GRADIENTS.length];
                const icon =
                  (entry.title || entry.subject || 'Q').trim().charAt(0) || 'Q';
                const timeLabel = formatTimeLabel(entry.updatedAt);
                const questionLabel =
                  Number.isFinite(entry.questionIndex)
                    ? `Question ${(entry.questionIndex ?? 0) + 1}`
                    : 'Saved question';
                const bookmarkHref = entry.href
                  ? appendQuery(entry.href, {
                      mode: entry.mode,
                      qid: entry.questionId,
                    })
                  : '';
                const isClickable = Boolean(bookmarkHref);

                if (isClickable) {
                  return (
                    <Link
                      key={entry.questionId}
                      href={bookmarkHref}
                      className="glass-card activity-item"
                      onClick={handleCardClick}
                    >
                      <div
                        className="activity-icon"
                        style={{ background: gradient }}
                      >
                        {icon.toUpperCase()}
                      </div>
                      <div className="activity-content">
                        <div className="activity-title">
                          {entry.title || 'Saved Question'}
                        </div>
                        <div className="activity-subtitle">{questionLabel}</div>
                      </div>
                      <div className="activity-time">{timeLabel}</div>
                    </Link>
                  );
                }

                return (
                  <div
                    key={entry.questionId}
                    className="glass-card activity-item is-disabled"
                  >
                    <div
                      className="activity-icon"
                      style={{ background: gradient }}
                    >
                      {icon.toUpperCase()}
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">
                        {entry.title || 'Saved Question'}
                      </div>
                      <div className="activity-subtitle">{questionLabel}</div>
                    </div>
                    <div className="activity-time">{timeLabel}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-shell {
          position: fixed;
          inset: 0;
          background: linear-gradient(
            135deg,
            #e0e7ff 0%,
            #d1d5ff 50%,
            #c7b8ff 100%
          );
          min-height: 100svh;
          overflow-x: hidden;
          height: 100svh;
          overflow-y: hidden;
          touch-action: pan-y;
        }

        .dashboard-shell .dashboard-frame {
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
        }

        .dashboard-card-skeletons {
          display: grid;
          gap: 12px;
        }

        .dashboard-card-skeleton {
          min-height: 78px;
          overflow: hidden;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.62) 25%, rgba(255, 255, 255, 0.94) 38%, rgba(255, 255, 255, 0.62) 63%);
          background-size: 400% 100%;
          animation: dashboardSkeletonShimmer 1.35s ease infinite;
        }

        @keyframes dashboardSkeletonShimmer {
          to { background-position: -100% 0; }
        }

        .dashboard-shell .dashboard-top {
          flex: 0 0 auto;
          position: relative;
          z-index: 20;
        }

        .dashboard-shell .dashboard-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          padding-right: 4px;
          padding-bottom: 8px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }

        .dashboard-shell .blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          transform: translate(var(--blob-x, 0px), var(--blob-y, 0px));
        }

        .dashboard-shell .blob::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          animation: float 20s infinite ease-in-out;
        }

        .dashboard-shell .blob-1 {
          width: 400px;
          height: 400px;
          top: -10%;
          left: -10%;
        }

        .dashboard-shell .blob-1::before {
          background: rgba(167, 139, 250, 0.4);
          animation-delay: 0s;
        }

        .dashboard-shell .blob-2 {
          width: 300px;
          height: 300px;
          top: 40%;
          right: -5%;
        }

        .dashboard-shell .blob-2::before {
          background: rgba(99, 102, 241, 0.3);
          animation-delay: -5s;
        }

        .dashboard-shell .blob-3 {
          width: 350px;
          height: 350px;
          bottom: -10%;
          left: 30%;
        }

        .dashboard-shell .blob-3::before {
          background: rgba(139, 92, 246, 0.3);
          animation-delay: -10s;
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .dashboard-shell .glass-card {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: 24px;
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          will-change: transform, opacity;
        }

        .dashboard-shell .glass-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 40px rgba(31, 38, 135, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.35);
        }

        .dashboard-shell .section-switcher {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          padding: 8px;
          margin-bottom: 16px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.42);
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 16px 42px rgba(79, 70, 229, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
        }

        .dashboard-shell .section-pill {
          min-width: 0;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 21px;
          color: rgba(75, 85, 99, 0.72);
          font-size: 0.77rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1;
          transition:
            transform 0.24s ease,
            color 0.24s ease,
            background 0.24s ease,
            box-shadow 0.24s ease;
        }

        .dashboard-shell .section-pill span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-shell .section-pill-icon {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          stroke-width: 2.6;
        }

        .dashboard-shell .section-pill:hover {
          color: #4f46e5;
          background: rgba(255, 255, 255, 0.25);
        }

        .dashboard-shell .section-pill:active {
          transform: scale(0.98);
        }

        .dashboard-shell .section-pill.active {
          color: #4f46e5;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 12px 28px rgba(79, 70, 229, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
        }

        .dashboard-shell .nav-container {
          background: rgba(255, 255, 255, 0.35);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border-radius: 16px;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .dashboard-shell .subject-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 4px;
        }

        .dashboard-shell .nav-tab {
          position: relative;
          z-index: 1;
          transition: all 0.3s ease;
          cursor: pointer;
          border-radius: 12px;
          padding: 10px 8px;
          font-weight: 600;
          font-size: 0.875rem;
          color: rgba(75, 85, 99, 0.8);
          letter-spacing: 0.05em;
          text-align: center;
          white-space: nowrap;
        }

        .dashboard-shell .nav-tab.active {
          color: #4f46e5;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.9);
        }

        .dashboard-shell .nav-tab:hover:not(.active) {
          color: #6366f1;
          background: rgba(255, 255, 255, 0.2);
        }

        .dashboard-shell .activity-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          margin-bottom: 12px;
          cursor: pointer;
        }

        .dashboard-shell .activity-item.is-disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .dashboard-shell .activity-icon {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .dashboard-shell .activity-content {
          flex: 1;
          min-width: 0;
        }

        .dashboard-shell .activity-title {
          font-weight: 600;
          color: #1f2937;
          font-size: 1rem;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-shell .activity-subtitle {
          color: #6b7280;
          font-size: 0.875rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dashboard-shell .activity-time {
          color: #9ca3af;
          font-size: 0.875rem;
          font-weight: 500;
          flex: 0 0 auto;
        }

        .dashboard-shell .empty-state {
          padding: 20px;
          text-align: center;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .dashboard-shell .close-btn {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          background: rgba(255, 255, 255, 0.36);
          border: none;
          border-radius: 12px;
          padding: 0;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #4b5563;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .dashboard-shell .close-btn:hover {
          color: #1f2937;
          background: rgba(255, 255, 255, 0.58);
          transform: scale(1.05);
        }

        .dashboard-shell .section-label {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 12px;
          padding-left: 8px;
        }

        .dashboard-shell .brain-scan-card {
          min-width: 0;
        }

        .dashboard-shell .page-content {
          animation: liquidSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform-origin: top center;
        }

        @media (max-width: 480px) {
          .dashboard-shell .dashboard-frame {
            padding: 14px;
            padding-top: max(14px, env(safe-area-inset-top));
            padding-bottom: max(14px, env(safe-area-inset-bottom));
            gap: 10px;
          }

          .dashboard-shell .section-switcher {
            padding: 6px;
            gap: 5px;
            margin-bottom: 14px;
            border-radius: 24px;
          }

          .dashboard-shell .section-pill {
            min-height: 46px;
            border-radius: 18px;
            gap: 5px;
            padding: 0 5px;
            font-size: 0.68rem;
            letter-spacing: 0.02em;
          }

          .dashboard-shell .section-pill-icon {
            width: 16px;
            height: 16px;
          }

          .dashboard-shell .nav-container {
            padding: 5px;
            border-radius: 14px;
          }

          .dashboard-shell .nav-tab {
            padding: 9px 4px;
            font-size: 0.72rem;
            letter-spacing: 0.02em;
          }

          .dashboard-shell .activity-item {
            gap: 12px;
            padding: 14px;
            border-radius: 18px;
          }

          .dashboard-shell .activity-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
            font-size: 1rem;
          }

          .dashboard-shell .activity-title {
            font-size: 0.94rem;
          }

          .dashboard-shell .activity-subtitle,
          .dashboard-shell .activity-time {
            font-size: 0.8rem;
          }
        }

        @keyframes liquidSlideUp {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }

        .dashboard-shell .dashboard-ripple {
          position: absolute;
          width: 100px;
          height: 100px;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.3);
          transform: scale(0);
          animation: ripple 0.6s ease-out;
          pointer-events: none;
        }
      `}</style>
    </main>
  );
}
