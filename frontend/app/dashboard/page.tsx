'use client';

import { useEffect, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Manrope } from 'next/font/google';
import ProtectedRoute from '@/components/ProtectedRoute';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
});

type TabKey = 'math' | 'eng' | 'reasoning' | 'ga';
type NavKey = 'recent' | 'bookmark';

type ActivityItem = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  time: string;
  gradient?: string;
};

const TOP_TABS: { label: string; value: TabKey }[] = [
  { label: 'MATH', value: 'math' },
  { label: 'ENG', value: 'eng' },
  { label: 'REASONING', value: 'reasoning' },
  { label: 'GA', value: 'ga' },
];

const TAB_CONTENT: Record<TabKey, ActivityItem[]> = {
  math: [
    {
      id: 'math-percentages',
      icon: 'M',
      title: 'Percentages',
      subtitle: 'Q5 of 386',
      time: '3:25 PM',
      gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
    },
    {
      id: 'math-algebra',
      icon: 'A',
      title: 'Algebra Basics',
      subtitle: 'Q12 of 150',
      time: '2:15 PM',
      gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777)',
    },
    {
      id: 'math-geometry',
      icon: 'G',
      title: 'Geometry',
      subtitle: 'Q8 of 200',
      time: 'Yesterday',
      gradient: 'linear-gradient(135deg, #34d399 0%, #059669)',
    },
    {
      id: 'math-calculus',
      icon: 'C',
      title: 'Calculus I',
      subtitle: 'Q3 of 120',
      time: 'Yesterday',
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #d97706)',
    },
  ],
  eng: [
    {
      id: 'eng-grammar',
      icon: 'E',
      title: 'Grammar Fundamentals',
      subtitle: 'Q7 of 245',
      time: '4:30 PM',
      gradient: 'linear-gradient(135deg, #60a5fa 0%, #2563eb)',
    },
    {
      id: 'eng-vocab',
      icon: 'V',
      title: 'Vocabulary Builder',
      subtitle: 'Q15 of 500',
      time: '1:20 PM',
      gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed)',
    },
  ],
  reasoning: [
    {
      id: 'reasoning-logic',
      icon: 'L',
      title: 'Logical Puzzles',
      subtitle: 'Q4 of 180',
      time: '5:45 PM',
      gradient: 'linear-gradient(135deg, #f87171 0%, #dc2626)',
    },
    {
      id: 'reasoning-analytical',
      icon: 'A',
      title: 'Analytical Reasoning',
      subtitle: 'Q9 of 220',
      time: '11:30 AM',
      gradient: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488)',
    },
  ],
  ga: [
    {
      id: 'ga-history',
      icon: 'W',
      title: 'World History',
      subtitle: 'Q6 of 300',
      time: '6:00 PM',
      gradient: 'linear-gradient(135deg, #fb923c 0%, #ea580c)',
    },
    {
      id: 'ga-science',
      icon: 'S',
      title: 'Science & Tech',
      subtitle: 'Q11 of 175',
      time: '9:15 AM',
      gradient: 'linear-gradient(135deg, #e879f9 0%, #c026d3)',
    },
  ],
};

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('math');
  const [activeNav, setActiveNav] = useState<NavKey>('recent');
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    setAnimationKey((prev) => prev + 1);
  }, [activeTab]);

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const blobs = document.querySelectorAll<HTMLElement>(
        '.dashboard-shell .blob'
      );
      blobs.forEach((blob, index) => {
        const speed = (index + 1) * 20;
        const xOffset = (window.innerWidth / 2 - event.clientX) / speed;
        const yOffset = (window.innerHeight / 2 - event.clientY) / speed;
        blob.style.setProperty('--blob-x', `${xOffset}px`);
        blob.style.setProperty('--blob-y', `${yOffset}px`);
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleCardClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'dashboard-ripple';
    ripple.style.left = `${event.clientX - rect.left - 50}px`;
    ripple.style.top = `${event.clientY - rect.top - 50}px`;
    card.appendChild(ripple);

    window.setTimeout(() => ripple.remove(), 600);
  };

  return (
    <main className={`dashboard-shell relative ${manrope.className}`}>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Dashboard
            </p>
            <h1 className="text-2xl font-bold text-gray-800">
              Recent activity
            </h1>
          </div>
          <button className="search-btn" type="button" aria-label="Search">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>

        <div className="nav-container mb-6">
          <div className="flex justify-between">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`nav-tab ${
                  activeTab === tab.value ? 'active' : ''
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex-1">
          <div key={`${activeTab}-${animationKey}`} className="page-content">
            <div className="section-label">Recent Quiz</div>
            {TAB_CONTENT[activeTab].map((item, index) => (
              <div
                key={item.id}
                className="glass-card activity-item animate-in"
                style={{ animationDelay: `${(index + 1) * 0.1}s` }}
                onClick={handleCardClick}
              >
                <div
                  className="activity-icon"
                  style={item.gradient ? { background: item.gradient } : undefined}
                >
                  {item.icon}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{item.title}</div>
                  <div className="activity-subtitle">{item.subtitle}</div>
                </div>
                <div className="activity-time">{item.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="bottom-nav">
            <button
              type="button"
              className={`nav-pill ${activeNav === 'recent' ? 'active' : ''}`}
              onClick={() => setActiveNav('recent')}
            >
              <div className="diamond" />
              <span>RECENT QUIZ</span>
            </button>
            <button
              type="button"
              className={`nav-pill ${activeNav === 'bookmark' ? 'active' : ''}`}
              onClick={() => setActiveNav('bookmark')}
            >
              <div
                className={`bookmark-dot ${
                  activeNav === 'bookmark' ? 'active' : ''
                }`}
              />
              <span>BOOKMARK</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .dashboard-shell {
          background: linear-gradient(
            135deg,
            #e0e7ff 0%,
            #d1d5ff 50%,
            #c7b8ff 100%
          );
          min-height: 100vh;
          overflow-x: hidden;
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
        }

        .dashboard-shell .glass-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 20px 40px rgba(31, 38, 135, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.35);
        }

        .dashboard-shell .nav-container {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(20px);
          border-radius: 16px;
          padding: 6px;
          position: relative;
          overflow: hidden;
        }

        .dashboard-shell .nav-tab {
          position: relative;
          z-index: 1;
          transition: all 0.3s ease;
          cursor: pointer;
          border-radius: 12px;
          padding: 10px 20px;
          font-weight: 600;
          font-size: 0.875rem;
          color: rgba(75, 85, 99, 0.8);
          letter-spacing: 0.05em;
        }

        .dashboard-shell .nav-tab.active {
          color: #4f46e5;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.2);
        }

        .dashboard-shell .nav-tab:hover:not(.active) {
          color: #6366f1;
          background: rgba(255, 255, 255, 0.2);
        }

        .dashboard-shell .bottom-nav {
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          padding: 8px;
          display: flex;
          gap: 8px;
          box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .dashboard-shell .nav-pill {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 18px;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
          color: rgba(75, 85, 99, 0.7);
        }

        .dashboard-shell .nav-pill.active {
          background: rgba(255, 255, 255, 0.9);
          color: #4f46e5;
          box-shadow: 0 4px 20px rgba(79, 70, 229, 0.25);
        }

        .dashboard-shell .nav-pill:not(.active):hover {
          background: rgba(255, 255, 255, 0.3);
          color: #6366f1;
        }

        .dashboard-shell .diamond {
          width: 12px;
          height: 12px;
          background: #4f46e5;
          transform: rotate(45deg);
          border-radius: 2px;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
        }

        .dashboard-shell .bookmark-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #9ca3af;
          transition: all 0.3s ease;
        }

        .dashboard-shell .bookmark-dot.active {
          background: #4f46e5;
          box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
        }

        .dashboard-shell .activity-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 20px;
          margin-bottom: 12px;
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
        }

        .dashboard-shell .activity-title {
          font-weight: 600;
          color: #1f2937;
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .dashboard-shell .activity-subtitle {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .dashboard-shell .activity-time {
          color: #9ca3af;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .dashboard-shell .search-btn {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          color: #4b5563;
        }

        .dashboard-shell .search-btn:hover {
          background: rgba(255, 255, 255, 0.8);
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
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

        .dashboard-shell .page-content {
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .dashboard-shell .animate-in {
          animation: slideUp 0.5s ease forwards;
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