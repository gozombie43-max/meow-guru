'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useThemeMode } from '@/hooks/useTheme';
import './play.css';

type PlayCategory = 'All' | 'Tests' | 'Practice' | 'Review';

type PlayMode = {
  id: string;
  title: string;
  category: Exclude<PlayCategory, 'All'>;
  duration: string;
  questions: string;
  href: string;
  icon: string;
};

const categories: PlayCategory[] = ['All', 'Tests', 'Practice', 'Review'];

const playModes: PlayMode[] = [
  { id: 'mock', title: 'Exam Simulation', category: 'Tests', duration: '60 min', questions: '100 Qs', href: '/mock-test', icon: '📋' },
  { id: 'adaptive', title: 'AI Adaptive', category: 'Practice', duration: '40 min', questions: 'Mixed', href: '/dashboard', icon: '⚡' },
  { id: 'weak-area', title: 'Weak Area Target', category: 'Practice', duration: '30 min', questions: '25 Qs', href: '/dashboard', icon: '🎯' },
  { id: 'speed', title: 'Speed Drill', category: 'Practice', duration: '20 min', questions: '20 Qs', href: '/mathematics/arithmetic/percentages/quiz', icon: '⏱️' },
  { id: 'revision', title: 'Revision Mode', category: 'Review', duration: '25 min', questions: 'Notes + Qs', href: '/mathematics', icon: '📖' },
  { id: 'mistakes', title: 'Mistake Analysis', category: 'Review', duration: '15 min', questions: 'Personal', href: '/dashboard', icon: '🛡️' },
  { id: 'sectional', title: 'Sectional Practice', category: 'Tests', duration: '50 min', questions: '50 Qs', href: '/mathematics', icon: '📑' },
  { id: 'concepts', title: 'Concept Builder', category: 'Practice', duration: '35 min', questions: 'Guided', href: '/notes', icon: '🧠' },
];

export default function PlayPage() {
  const router = useRouter();
  const [category, setCategory] = useState<PlayCategory>('All');
  const { theme } = useThemeMode();
  const isDark = theme === 'dark';

  const filteredModes = useMemo(() => {
    return playModes.filter((mode) => {
      if (category === 'All') return true;
      return mode.category === category;
    });
  }, [category]);

  const handleStart = (href: string) => {
    router.push(href);
  };

  return (
    <div className={`study-modes-wrapper ${isDark ? 'dark' : ''}`}>
      <main className="container">
        <div className="tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`tab ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div>
          {filteredModes.map((mode) => (
            <div key={mode.id} className="card">
              <div className="card-left">
                <div className="icon">{mode.icon}</div>
                <div className="info">
                  <div className="category">{mode.category}</div>
                  <h3>{mode.title}</h3>
                  <div className="meta">⏱ {mode.duration} · {mode.questions}</div>
                </div>
              </div>
              <button className="btn" onClick={() => handleStart(mode.href)}>Start</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
