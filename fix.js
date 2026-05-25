const fs = require('fs');
const content = \'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Optionally default to dark if preferred
  }, []);

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
    <div className={\\\study-modes-wrapper \\\\\\}>
      <main className="container">
        <div className="topbar">
          <div className="toggle-wrap">
            <span className="toggle-label" id="toggle-lbl">
              {isDark ? '🌙 Dark' : '☀️ Light'}
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={isDark}
                onChange={(e) => setIsDark(e.target.checked)}
              />
              <div className="track"></div>
              <div className="thumb" id="thumb-icon">
                {isDark ? '🌙' : '☀️'}
              </div>
            </label>
          </div>
        </div>

        <div className="tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              className={\\\	ab \\\\\\}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        
        <div className="modes-badge">📈 {playModes.length} modes</div>

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
\;
fs.writeFileSync('c:/Users/91906/Ai ssc/frontend/app/play/page.tsx', content);
