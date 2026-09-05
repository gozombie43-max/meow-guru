'use client';

import { useThemeMode } from '@/hooks/useTheme';
import {
BookOpen,
ChevronRight,
ClipboardList,
Layers,
Lightbulb,
ShieldAlert,
Target,
Timer,
Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo,useState } from 'react';
import './play.css';

type PlayCategory = 'All' | 'Tests' | 'Practice' | 'Review';

type PlayMode = {
  id: string;
  title: string;
  category: Exclude<PlayCategory, 'All'>;
  duration: string;
  questions: string;
  href: string;
  icon: React.ReactNode;
};

const categories: PlayCategory[] = ['All', 'Tests', 'Practice', 'Review'];

const playModes: PlayMode[] = [
  { id: 'mock', title: 'Exam Simulation', category: 'Tests', duration: '60 min', questions: '100 Qs', href: '/mock-test', icon: <ClipboardList size={22} className="lucide-icon text-accent" /> },
  { id: 'adaptive', title: 'AI Adaptive', category: 'Practice', duration: '40 min', questions: 'Mixed', href: '/adaptive-quiz', icon: <Zap size={22} className="lucide-icon text-accent" /> },
  { id: 'weak-area', title: 'Weak Area Target', category: 'Practice', duration: '30 min', questions: '25 Qs', href: '/dashboard', icon: <Target size={22} className="lucide-icon text-accent" /> },
  { id: 'speed', title: 'Speed Drill', category: 'Practice', duration: '20 min', questions: '20 Qs', href: '/mathematics/arithmetic/percentages/quiz', icon: <Timer size={22} className="lucide-icon text-accent" /> },
  { id: 'revision', title: 'Revision Mode', category: 'Review', duration: '25 min', questions: 'Notes + Qs', href: '/mathematics', icon: <BookOpen size={22} className="lucide-icon text-accent" /> },
  { id: 'mistakes', title: 'Mistake Analysis', category: 'Review', duration: '15 min', questions: 'Personal', href: '/dashboard', icon: <ShieldAlert size={22} className="lucide-icon text-accent" /> },
  { id: 'sectional', title: 'Sectional Practice', category: 'Tests', duration: '50 min', questions: '50 Qs', href: '/mathematics', icon: <Layers size={22} className="lucide-icon text-accent" /> },
  { id: 'concepts', title: 'Concept Builder', category: 'Practice', duration: '35 min', questions: 'Guided', href: '/notes', icon: <Lightbulb size={22} className="lucide-icon text-accent" /> },
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
      <div className="macos-window">
        {/* Desktop Sidebar */}
        <aside className="macos-sidebar">
          <div className="macos-traffic-lights">
            <div className="traffic-light close"></div>
            <div className="traffic-light minimize"></div>
            <div className="traffic-light maximize"></div>
          </div>
          
          <h2 className="sidebar-title">Categories</h2>
          <div className="sidebar-nav">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`sidebar-tab ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <div className="macos-content">
          <main className="container">
            {/* iOS Mobile Header */}
            <div className="ios-header">
              <h1 className="ios-large-title">Play</h1>
              
              <div className="ios-segmented-control">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`segment ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    <span>{cat}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grouped List */}
            <div className="ios-list-group">
              {filteredModes.map((mode, index) => (
                <div key={mode.id} className="ios-list-cell" onClick={() => handleStart(mode.href)}>
                  <div className={`cell-icon theme-${mode.category.toLowerCase()}`}>
                    {mode.icon}
                  </div>
                  <div className="cell-body">
                    <div className="cell-content">
                      <div className="cell-title">{mode.title}</div>
                      <div className="cell-subtitle">{mode.duration} · {mode.questions}</div>
                    </div>
                    <div className="cell-accessory">
                      <ChevronRight size={20} className="chevron" strokeWidth={2.5} />
                    </div>
                  </div>
                  {index < filteredModes.length - 1 && <div className="cell-separator" />}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
