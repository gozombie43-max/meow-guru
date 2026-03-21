'use client';

import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user } = useAuth();

  const topics = Object.entries(user?.progress || {});
  const totalAttempted = topics.reduce((s, [, v]) => s + v.attempted, 0);
  const totalCorrect   = topics.reduce((s, [, v]) => s + v.correct, 0);
  const accuracy       = totalAttempted > 0
    ? Math.round((totalCorrect / totalAttempted) * 100)
    : 0;

  return (
    <main className="min-h-screen pt-8 px-4">
      <div className="max-w-4xl mx-auto py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Welcome back, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Attempted', value: totalAttempted },
            { label: 'Correct',   value: totalCorrect },
            { label: 'Accuracy',  value: `${accuracy}%` },
          ].map((s) => (
            <div key={s.label} className="glass-card text-center">
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Topic Progress */}
        <div className="glass-panel mb-6">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Topic Progress</h2>
          {topics.length === 0 ? (
            <p className="text-slate-400 text-sm">No questions attempted yet. Start practicing!</p>
          ) : (
            <div className="space-y-3">
              {topics.map(([topic, data]) => (
                <div key={topic}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{topic}</span>
                    <span className="text-slate-400">{data.correct}/{data.attempted}</span>
                  </div>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((data.correct / data.attempted) * 100)}%`,
                        background: 'linear-gradient(90deg, #00e5ff, #26c6da)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bookmarks */}
        <div className="glass-panel mb-6">
          <h2 className="font-semibold text-[var(--text-primary)] mb-2">Bookmarks</h2>
          <p className="text-slate-400 text-sm">
            {user?.bookmarks?.length
              ? `${user.bookmarks.length} questions saved`
              : 'No bookmarks yet'}
          </p>
        </div>

        {/* Start Practicing */}
        <div className="glass-panel flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-[var(--text-primary)]">Ready to practice?</h3>
            <p className="text-slate-500 text-sm mt-1">Pick a topic and start solving</p>
          </div>
          <Link href="/mathematics" className="btn-glow px-5 py-2 rounded-full text-sm font-semibold">
            Start Quiz →
          </Link>
        </div>

      </div>
    </main>
  );
}