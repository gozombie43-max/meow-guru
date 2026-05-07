'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['700'] });

/* ─────────── DATA ─────────── */

const featuredModes = [
  {
    title: 'Exam Sim',
    copy: 'Real exam pressure',
    badge: '🔥 Hot',
    theme: 'green',
    href: '/mock-test/index.html',
    mascot: 'clock',
  },
  {
    title: 'AI Adaptive',
    copy: 'Personalized path',
    badge: '🤖 AI',
    theme: 'blue',
    href: '/dashboard',
    mascot: 'robot',
  },
  {
    title: 'Weak Target',
    copy: 'Fix weak spots',
    badge: '📈 Up',
    theme: 'purple',
    href: '/dashboard',
    mascot: 'graph',
  },
];

const allModes = [
  {
    title: 'Exam Simulation Mode',
    copy: 'Full mock · Timer · Negative marking',
    accent: '#00e87a',
    gradient: 'linear-gradient(135deg,#00703f,#00e87a)',
    href: '/mock-test/index.html',
    icon: 'exam',
  },
  {
    title: 'Adaptive AI Mode',
    copy: 'Dynamic difficulty · Instant explain',
    accent: '#3b8fff',
    gradient: 'linear-gradient(135deg,#1a5fbf,#3b8fff)',
    href: '/dashboard',
    icon: 'ai',
  },
  {
    title: 'Weak Area Target',
    copy: 'Focused weak topic questions',
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg,#6d28d9,#a855f7)',
    href: '/dashboard',
    icon: 'target',
  },
  {
    title: 'Revision Mode',
    copy: 'Spaced recall · Mixed past attempts',
    accent: '#ff7c2a',
    gradient: 'linear-gradient(135deg,#b84900,#ff7c2a)',
    href: '/dashboard',
    icon: 'revision',
  },
  {
    title: 'Mistake Analysis',
    copy: 'Wrong-only · Deep explanations',
    accent: '#ff3d5a',
    gradient: 'linear-gradient(135deg,#9b0020,#ff3d5a)',
    href: '/dashboard',
    icon: 'mistake',
  },
  {
    title: 'Speed Drill Mode',
    copy: 'Short timer · Rapid fire questions',
    accent: '#ffd600',
    gradient: 'linear-gradient(135deg,#a38900,#ffd600)',
    href: '/dashboard',
    icon: 'speed',
  },
  {
    title: 'Accuracy Mode',
    copy: 'Heavy penalty · Precision training',
    accent: '#00d4ff',
    gradient: 'linear-gradient(135deg,#0087a3,#00d4ff)',
    href: '/dashboard',
    icon: 'accuracy',
  },
  {
    title: 'Sectional Practice',
    copy: 'Quant · Reasoning · English · GK',
    accent: '#ff4fa3',
    gradient: 'linear-gradient(135deg,#a3006a,#ff4fa3)',
    href: '/dashboard',
    icon: 'sectional',
  },
  {
    title: 'PYQ Mode',
    copy: 'Previous year papers only',
    accent: '#00e87a',
    gradient: 'linear-gradient(135deg,#005c31,#00e87a)',
    href: '/dashboard',
    icon: 'pyq',
  },
  {
    title: 'Concept Builder',
    copy: 'Topic-wise · Deep fundamentals',
    accent: '#a855f7',
    gradient: 'linear-gradient(135deg,#4c1d95,#a855f7)',
    href: '/dashboard',
    icon: 'concept',
  },
];

const searchModes = allModes.map((m, i) => ({
  icon: ['⏱️', '🤖', '🎯', '🔁', '❌', '⚡', '🎯', '📊', '🔮', '🧩'][i],
  name: m.title,
}));

const subjectCards = [
  { title: 'Mathematics', copy: 'Geometry, algebra, arithmetic', href: '/mathematics', accent: '#00e87a' },
  { title: 'Reasoning', copy: 'Logic, sequences, patterns', href: '/reasoning', accent: '#3b8fff' },
  { title: 'English', copy: 'Grammar, vocab, comprehension', href: '/english', accent: '#a855f7' },
  { title: 'General Awareness', copy: 'Static GK, history, polity', href: '/general-awareness', accent: '#ffb547' },
];

/* ─────────── SVG MASCOTS ─────────── */

function FoxMascot() {
  return (
    <svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="foxBody" x1="60" y1="40" x2="60" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff9a3c" />
          <stop offset="100%" stopColor="#ff6b2c" />
        </linearGradient>
        <linearGradient id="foxEar" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#ff3d5a" />
          <stop offset="100%" stopColor="#ff7c2a" />
        </linearGradient>
        <linearGradient id="foxBelly" x1="60" y1="70" x2="60" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe4c7" />
          <stop offset="100%" stopColor="#ffcfa0" />
        </linearGradient>
      </defs>
      <g style={{ animation: 'foxTail 2.5s ease-in-out infinite', transformOrigin: '35px 105px' }}>
        <ellipse cx="28" cy="108" rx="24" ry="14" fill="url(#foxBody)" transform="rotate(-15 28 108)" />
        <ellipse cx="20" cy="112" rx="12" ry="8" fill="#ffe4c7" transform="rotate(-15 20 112)" />
      </g>
      <ellipse cx="60" cy="95" rx="34" ry="28" fill="url(#foxBody)" />
      <ellipse cx="60" cy="100" rx="20" ry="16" fill="url(#foxBelly)" />
      <rect x="38" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      <rect x="68" y="118" width="14" height="12" rx="7" fill="url(#foxBody)" />
      <g style={{ animation: 'foxBreathe 3s ease-in-out infinite', transformOrigin: '60px 55px' }}>
        <g style={{ animation: 'foxEarLeft 4s ease-in-out infinite', transformOrigin: '38px 25px' }}>
          <path d="M28 38 L22 8 L42 24 Z" fill="url(#foxBody)" />
          <path d="M30 35 L26 14 L38 26 Z" fill="#ff3d5a" />
        </g>
        <g style={{ animation: 'foxEarRight 4s ease-in-out infinite 0.2s', transformOrigin: '82px 25px' }}>
          <path d="M72 38 L78 8 L58 24 Z" fill="url(#foxBody)" />
          <path d="M70 35 L74 14 L62 26 Z" fill="#ff3d5a" />
        </g>
        <circle cx="60" cy="52" r="28" fill="url(#foxBody)" />
        <ellipse cx="60" cy="58" rx="16" ry="14" fill="url(#foxBelly)" />
        <g style={{ animation: 'foxBlink 5s ease-in-out infinite' }}>
          <circle cx="50" cy="48" r="6" fill="#1a0a00" />
          <circle cx="70" cy="48" r="6" fill="#1a0a00" />
          <circle cx="52" cy="46" r="2.2" fill="#fff" />
          <circle cx="72" cy="46" r="2.2" fill="#fff" />
        </g>
        <ellipse cx="60" cy="56" rx="3.5" ry="2.5" fill="#1a0a00" />
        <path d="M50 62 Q60 72 70 62" stroke="#1a0a00" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <ellipse cx="42" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
        <ellipse cx="78" cy="58" rx="6" ry="4" fill="#ff9eb5" opacity="0.5" />
      </g>
    </svg>
  );
}

function ClockMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <defs>
        <linearGradient id="clockFace" x1="40" y1="10" x2="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#f0f0f0" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="32" fill="none" stroke="#ff3d5a" strokeWidth="1" opacity="0.3" style={{ animation: 'clockPulse 2s ease-in-out infinite' }} />
      <circle cx="40" cy="40" r="30" fill="url(#clockFace)" stroke="#ffcc00" strokeWidth="2.5" />
      <g stroke="#999" strokeWidth="1.5" strokeLinecap="round">
        <line x1="40" y1="14" x2="40" y2="18" />
        <line x1="40" y1="62" x2="40" y2="66" />
        <line x1="14" y1="40" x2="18" y2="40" />
        <line x1="62" y1="40" x2="66" y2="40" />
      </g>
      <line x1="40" y1="40" x2="40" y2="24" stroke="#333" strokeWidth="3" strokeLinecap="round" />
      <g style={{ animation: 'clockSweep 3s linear infinite', transformOrigin: '40px 40px' }}>
        <line x1="40" y1="40" x2="40" y2="16" stroke="#ff3d5a" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'clockGlow 1.5s ease-in-out infinite' }} />
      </g>
      <circle cx="40" cy="40" r="4" fill="#333" />
      <circle cx="40" cy="40" r="2" fill="#ff3d5a" />
      <g style={{ animation: 'iconFloat 2s ease-in-out infinite' }}>
        <path d="M62 18 Q65 22 62 28 Q59 22 62 18Z" fill="#60c5ff" opacity="0.9" />
      </g>
      <path d="M28 32 Q31 29 34 31" stroke="#555" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M46 31 Q49 29 52 32" stroke="#555" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <ellipse cx="31" cy="35" rx="2.5" ry="3" fill="#333" />
      <ellipse cx="49" cy="35" rx="2.5" ry="3" fill="#333" />
      <path d="M28 46 Q40 40 52 46" stroke="#555" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function RobotMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <defs>
        <linearGradient id="robotBody" x1="40" y1="20" x2="40" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="22" y="42" width="36" height="26" rx="8" fill="url(#robotBody)" />
      <rect x="28" y="48" width="10" height="6" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="42" y="48" width="10" height="6" rx="3" fill="rgba(255,255,255,0.3)" />
      <rect x="30" y="58" width="20" height="4" rx="2" fill="rgba(255,255,255,0.4)" />
      <rect x="34" y="36" width="12" height="8" rx="3" fill="#2563eb" />
      <g style={{ animation: 'robotFloat 2.5s ease-in-out infinite' }}>
        <rect x="18" y="14" width="44" height="24" rx="10" fill="url(#robotBody)" />
        <line x1="40" y1="14" x2="40" y2="6" stroke="#2563eb" strokeWidth="2.5" />
        <circle cx="40" cy="5" r="3.5" fill="#00d4ff" style={{ animation: 'antennaPulse 2s ease-in-out infinite' }} />
        <rect x="24" y="20" width="12" height="10" rx="4" fill="#0f172a" />
        <rect x="44" y="20" width="12" height="10" rx="4" fill="#0f172a" />
        <rect x="26" y="22" width="8" height="6" rx="2" fill="#00d4ff" opacity="0.9" style={{ animation: 'scanBeam 2s ease-in-out infinite' }} />
        <rect x="46" y="22" width="8" height="6" rx="2" fill="#00d4ff" opacity="0.9" style={{ animation: 'scanBeam 2s ease-in-out infinite 0.3s' }} />
        <rect x="30" y="32" width="20" height="2.5" rx="1.25" fill="rgba(255,255,255,0.4)" />
        <circle cx="34" cy="33.25" r="1.2" fill="rgba(255,255,255,0.8)" />
        <circle cx="40" cy="33.25" r="1.2" fill="rgba(255,255,255,0.8)" />
        <circle cx="46" cy="33.25" r="1.2" fill="rgba(255,255,255,0.8)" />
      </g>
      <rect x="10" y="44" width="12" height="7" rx="3.5" fill="#2563eb" />
      <rect x="58" y="44" width="12" height="7" rx="3.5" fill="#2563eb" />
    </svg>
  );
}

function GraphMascot() {
  return (
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style={{ width: 80, height: 80 }}>
      <g style={{ animation: 'iconFloat 3s ease-in-out infinite' }}>
        <circle cx="40" cy="32" r="20" fill="#a855f7" />
        <circle cx="33" cy="29" r="5" fill="#fff" />
        <circle cx="47" cy="29" r="5" fill="#fff" />
        <circle cx="34" cy="29" r="2.5" fill="#4c1d95" />
        <circle cx="48" cy="29" r="2.5" fill="#4c1d95" />
        <circle cx="35" cy="28" r="1" fill="#fff" />
        <circle cx="49" cy="28" r="1" fill="#fff" />
        <path d="M30 38 Q40 48 50 38" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M30 38 Q40 48 50 38" stroke="#ff9eb5" strokeWidth="2" strokeLinecap="round" fill="#ff9eb5" opacity="0.5" />
        <ellipse cx="24" cy="36" rx="5" ry="3.5" fill="#ff9eb5" opacity="0.4" />
        <ellipse cx="56" cy="36" rx="5" ry="3.5" fill="#ff9eb5" opacity="0.4" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.1s', transformOrigin: '20px 70px' }}>
        <rect x="14" y="62" width="10" height="10" rx="3" fill="#a855f7" opacity="0.6" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.3s', transformOrigin: '32px 70px' }}>
        <rect x="26" y="56" width="10" height="16" rx="3" fill="#c084fc" opacity="0.8" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.5s', transformOrigin: '44px 70px' }}>
        <rect x="38" y="50" width="10" height="22" rx="3" fill="#d8b4fe" opacity="0.9" />
      </g>
      <g style={{ animation: 'barRise 1.5s ease-in-out infinite 0.7s', transformOrigin: '56px 70px' }}>
        <rect x="50" y="58" width="10" height="14" rx="3" fill="#a855f7" opacity="0.7" />
      </g>
      <g style={{ animation: 'arrowBounce 1.5s ease-in-out infinite' }}>
        <path d="M66 18 L74 28 L70 28 L70 36 L62 36 L62 28 L58 28 Z" fill="#ffd600" />
      </g>
    </svg>
  );
}

/* ─────────── LIST ICON SVGs ─────────── */

function ListIcon({ icon }: { icon: string }) {
  switch (icon) {
    case 'exam':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" style={{ animation: 'iconSpin 8s linear infinite', transformOrigin: '12px 12px' }} />
          <line x1="12" y1="12" x2="12" y2="7" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
        </svg>
      );
    case 'ai':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="3" y="11" width="18" height="10" rx="3" />
          <path d="M7 11V8a5 5 0 0 1 10 0v3" style={{ animation: 'iconFloat 2s ease-in-out infinite' }} />
          <line x1="12" y1="15" x2="12" y2="15.01" strokeWidth="3" strokeLinecap="round" />
          <circle cx="12" cy="7" r="1.5" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'target':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" />
          <line x1="18" y1="6" x2="14" y2="10" stroke="#ffd600" strokeWidth="2.5" />
          <polygon points="19,4 21,8 17,7" fill="#ffd600" stroke="none" />
        </svg>
      );
    case 'revision':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <polyline points="1 4 1 10 7 10" style={{ animation: 'iconShake 3s ease-in-out infinite', transformOrigin: '4px 7px' }} />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'mistake':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2.5" />
          <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2.5" />
          <circle cx="12" cy="12" r="1" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'speed':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <polygon points="13 2 4 14 12 14 11 22 20 10 12 10" fill="#fff" stroke="none" opacity="0.9" style={{ animation: 'iconShake 0.5s ease-in-out infinite' }} />
        </svg>
      );
    case 'accuracy':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="1.5" fill="#fff" stroke="none" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2" strokeWidth="1.5" opacity="0.5" />
        </svg>
      );
    case 'sectional':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="3" y="3" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0s', transformOrigin: '6.5px 6.5px' }} />
          <rect x="14" y="3" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.3s', transformOrigin: '17.5px 6.5px' }} />
          <rect x="3" y="14" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.6s', transformOrigin: '6.5px 17.5px' }} />
          <rect x="14" y="14" width="7" height="7" rx="2" style={{ animation: 'barRise 2s ease-in-out infinite 0.9s', transformOrigin: '17.5px 17.5px' }} />
        </svg>
      );
    case 'pyq':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 2v4M16 2v4M4 10h16" strokeWidth="1.8" />
          <circle cx="12" cy="15" r="2" fill="#fff" stroke="none" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    case 'concept':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" style={{ animation: 'iconFloat 3s ease-in-out infinite' }} />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
          <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" opacity="0.8" style={{ animation: 'iconPulse 2s ease-in-out infinite' }} />
        </svg>
      );
    default:
      return null;
  }
}

/* ─────────── SUBJECT ICON SVGs ─────────── */

function SubjectIcon({ title }: { title: string }) {
  if (title === 'Mathematics') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="18" y1="6" x2="14" y2="10" stroke="#ffd600" strokeWidth="2.5" />
      <polygon points="19,4 21,8 17,7" fill="#ffd600" stroke="none" />
    </svg>
  );
  if (title === 'Reasoning') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
  if (title === 'English') return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
      <circle cx="12" cy="8" r="5" />
      <path d="M3 21v-1a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7v1" />
    </svg>
  );
}

/* ─────────── MAIN PAGE ─────────── */

export default function PlayPage() {
  const [isDark, setIsDark] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredModes = searchQuery
    ? searchModes.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchModes;

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [searchOpen]);

  // Ripple effect handler
  const handleRipple = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.5;
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position:absolute; border-radius:50%; transform:scale(0);
      background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
      pointer-events:none; width:${size}px; height:${size}px; z-index:10;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      animation: ripple 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    `;
    card.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  };

  // 3D tilt
  const handleTiltMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = (y - rect.height / 2) / 15;
    const rotateY = (rect.width / 2 - x) / 15;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04) translateY(-8px)`;
  };

  const handleTiltLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = '';
  };

  const theme = isDark ? 'dark' : 'light';

  return (
    <div data-theme={theme} className={jakarta.className} style={{ minHeight: '100vh' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        [data-theme="dark"] {
          --bg: #07080a;
          --card-bg: rgba(20, 22, 30, 0.7);
          --card-border: rgba(255, 255, 255, 0.06);
          --text: #f0f2f8;
          --muted: #8b92a8;
          --surface: rgba(255, 255, 255, 0.04);
          --header-bg: rgba(7, 8, 10, 0.85);
          --shadow: rgba(0, 0, 0, 0.5);
        }
        [data-theme="light"] {
          --bg: #f5f7fb;
          --card-bg: rgba(255, 255, 255, 0.8);
          --card-border: rgba(0, 0, 0, 0.06);
          --text: #0d1117;
          --muted: #5c6270;
          --surface: rgba(0, 0, 0, 0.03);
          --header-bg: rgba(245, 247, 251, 0.85);
          --shadow: rgba(0, 0, 0, 0.08);
        }

        .page-root {
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          overflow-x: hidden;
          transition: background 0.5s ease, color 0.5s ease;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }
        .page-root::before {
          content: '';
          position: fixed; inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 15% 20%, rgba(59, 143, 255, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 85% 75%, rgba(0, 232, 122, 0.06) 0%, transparent 50%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(168, 85, 247, 0.04) 0%, transparent 50%);
          pointer-events: none; z-index: 0;
          animation: meshShift 20s ease-in-out infinite alternate;
        }
        @keyframes meshShift {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(2%, -1%) scale(1.02); }
          66% { transform: translate(-1%, 2%) scale(0.98); }
          100% { transform: translate(1%, 1%) scale(1); }
        }

        .app {
          max-width: 440px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
          padding-bottom: 32px;
        }

        /* ── HEADER ── */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 20px 12px;
          position: sticky; top: 0; z-index: 50;
          background: var(--header-bg);
          backdrop-filter: blur(24px) saturate(1.4);
          border-bottom: 1px solid var(--card-border);
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .avatar-wrap {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #ff3d5a 0%, #ff7c2a 50%, #ffd600 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 0 3px rgba(255, 61, 90, 0.2), 0 8px 24px rgba(255, 61, 90, 0.25);
          cursor: pointer; position: relative; overflow: hidden;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
          flex-shrink: 0;
        }
        .avatar-wrap:hover {
          transform: scale(1.08) rotate(-4deg);
          box-shadow: 0 0 0 4px rgba(255, 61, 90, 0.15), 0 12px 32px rgba(255, 61, 90, 0.35);
        }
        .avatar-wrap::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.2) 60%, transparent 100%);
          animation: avatarShine 4s ease-in-out infinite;
        }
        @keyframes avatarShine {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }

        .user-info h2 { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
        .user-info span {
          font-size: 12px; color: #00e87a; font-weight: 700;
          display: flex; align-items: center; gap: 4px;
          text-shadow: 0 0 12px rgba(0, 232, 122, 0.3);
        }
        .user-info span::before {
          content: ''; width: 6px; height: 6px; border-radius: 50%;
          background: #00e87a; box-shadow: 0 0 8px #00e87a;
          animation: pulseDot 2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }

        .header-icons { display: flex; gap: 10px; align-items: center; }
        .icon-btn {
          width: 40px; height: 40px; border-radius: 14px;
          background: var(--surface); border: 1px solid var(--card-border);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          color: var(--muted);
          position: relative; overflow: hidden;
        }
        .icon-btn:hover {
          transform: translateY(-2px) scale(1.05);
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 8px 24px var(--shadow);
          color: var(--text);
        }
        .icon-btn:active { transform: scale(0.95); }
        .icon-btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
        .notif-btn { position: relative; }
        .notif-btn::after {
          content: ''; position: absolute; top: 8px; right: 8px;
          width: 8px; height: 8px; border-radius: 50%;
          background: #ff3d5a; border: 2px solid var(--bg);
          animation: notifPulse 2s ease-in-out infinite;
        }
        @keyframes notifPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 61, 90, 0.4); }
          50% { box-shadow: 0 0 0 6px rgba(255, 61, 90, 0); }
        }

        /* ── SEARCH OVERLAY ── */
        .search-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(16px);
          display: flex; flex-direction: column;
          align-items: center; padding: 80px 20px 0;
          opacity: 0; pointer-events: none; transition: opacity 0.35s ease;
        }
        .search-overlay.active { opacity: 1; pointer-events: all; }
        .search-box {
          width: 100%; max-width: 440px;
          background: var(--header-bg);
          border: 1.5px solid #3b8fff;
          border-radius: 20px;
          display: flex; align-items: center; gap: 12px;
          padding: 14px 18px;
          box-shadow: 0 8px 32px rgba(59, 143, 255, 0.2), 0 0 0 1px rgba(59, 143, 255, 0.1), inset 0 1px 0 rgba(255,255,255,0.05);
          animation: searchDrop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes searchDrop {
          from { transform: translateY(-30px) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .search-box svg { width: 20px; height: 20px; stroke: #3b8fff; fill: none; stroke-width: 2.5; flex-shrink: 0; }
        .search-box input {
          flex: 1; background: none; border: none; outline: none;
          font-family: inherit; font-size: 16px; font-weight: 600;
          color: var(--text);
        }
        .search-box input::placeholder { color: var(--muted); font-weight: 500; }
        .search-close-btn {
          background: none; border: none; color: var(--muted);
          font-size: 20px; cursor: pointer; flex-shrink: 0;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          border-radius: 10px; transition: all 0.2s ease;
        }
        .search-close-btn:hover { background: var(--surface); color: var(--text); }
        .search-results {
          width: 100%; max-width: 440px; margin-top: 16px;
          background: var(--card-bg); border-radius: 20px;
          border: 1px solid var(--card-border);
          overflow: hidden; backdrop-filter: blur(20px);
          box-shadow: 0 20px 60px var(--shadow);
          animation: searchDrop 0.45s cubic-bezier(0.16, 1, 0.3, 1) 0.05s both;
        }
        .search-result-item {
          padding: 14px 18px; display: flex; align-items: center; gap: 12px;
          border-bottom: 1px solid var(--card-border); cursor: pointer;
          transition: all 0.2s ease;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: var(--surface); transform: translateX(4px); }
        .s-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; background: var(--surface); flex-shrink: 0;
        }
        .search-result-item span { font-size: 14px; font-weight: 700; color: var(--text); }

        /* ── HERO ── */
        .hero {
          margin: 12px 18px 6px;
          background: linear-gradient(135deg, #00b359 0%, #00d472 40%, #00c4a0 100%);
          border-radius: 24px;
          padding: 28px 24px 0;
          overflow: hidden; position: relative;
          min-height: 170px; cursor: pointer;
          box-shadow: 0 20px 60px rgba(0, 232, 122, 0.25), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease;
        }
        .hero:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 30px 80px rgba(0, 232, 122, 0.35), inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.25) 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.1) 0%, transparent 40%);
        }
        .hero::after {
          content: '';
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.1) 20%, transparent 40%);
          animation: heroRotate 8s linear infinite;
          pointer-events: none;
        }
        @keyframes heroRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hero-inner { position: relative; z-index: 2; display: flex; align-items: flex-end; justify-content: space-between; }
        .hero-text h1 {
          font-family: ${grotesk.style.fontFamily}, sans-serif;
          font-size: 26px; color: #001a09; font-weight: 900; line-height: 1.15;
          letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .hero-text p { font-size: 13px; color: #004d1f; font-weight: 700; margin: 6px 0 16px; opacity: 0.9; }
        .hero-btn {
          background: #001a09; color: #00e87a;
          border: none; border-radius: 14px;
          padding: 12px 28px; font-size: 14px; font-weight: 800;
          cursor: pointer; font-family: inherit;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          letter-spacing: 0.3px;
          position: relative; overflow: hidden;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        }
        .hero-btn:hover { transform: scale(1.06); box-shadow: 0 8px 28px rgba(0, 232, 122, 0.4); color: #fff; }
        .hero-btn:active { transform: scale(0.98); }
        .hero-mascot {
          width: 140px; height: 140px;
          display: flex; align-items: flex-end; justify-content: center;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.3));
          animation: foxFloat 4s ease-in-out infinite;
          flex-shrink: 0; margin-right: -10px; margin-bottom: -10px;
        }
        @keyframes foxFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-10px) rotate(2deg); }
          75% { transform: translateY(-6px) rotate(-1deg); }
        }

        /* ── SECTION HEAD ── */
        .section-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 20px 10px;
        }
        .section-head h3 { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; }
        .see-all {
          font-size: 13px; font-weight: 700; color: #00e87a;
          background: none; border: none; cursor: pointer;
          display: flex; align-items: center; gap: 4px;
          transition: all 0.2s ease;
          padding: 4px 10px; border-radius: 8px;
          font-family: inherit;
        }
        .see-all:hover { background: var(--surface); gap: 8px; }
        .see-all::after { content: '→'; transition: transform 0.2s ease; }
        .see-all:hover::after { transform: translateX(2px); }
        .see-all-blue { color: #3b8fff; }

        /* ── SCROLL ROW ── */
        .scroll-row {
          display: flex; gap: 14px;
          overflow-x: auto; padding: 6px 18px 16px;
          scrollbar-width: none;
        }
        .scroll-row::-webkit-scrollbar { display: none; }

        /* ── FEATURED MODE CARDS ── */
        .mode-card {
          flex: 0 0 170px; height: 220px;
          border-radius: 22px;
          position: relative; overflow: hidden;
          cursor: pointer;
          transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid rgba(255,255,255,0.08);
          transform-style: preserve-3d;
          perspective: 1000px;
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .mode-card:hover {
          box-shadow: 0 30px 60px rgba(0,0,0,0.4);
          border-color: rgba(255,255,255,0.2);
        }
        .card-bg {
          position: absolute; inset: 0; transition: transform 0.6s ease;
        }
        .mode-card:hover .card-bg { transform: scale(1.1); }
        .card-content {
          position: absolute; inset: 0; padding: 18px 14px;
          display: flex; flex-direction: column; justify-content: space-between;
          background: linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.75) 100%);
          z-index: 2;
        }
        .card-badge {
          background: rgba(0,0,0,0.4); backdrop-filter: blur(12px);
          border-radius: 24px; padding: 4px 12px; font-size: 11px;
          font-weight: 800; display: inline-flex; align-items: center; gap: 5px;
          width: fit-content; border: 1px solid rgba(255,255,255,0.12);
          color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .card-mascot {
          position: absolute; right: -8px; bottom: 40px;
          width: 90px; height: 90px;
          display: flex; align-items: center; justify-content: center;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));
          z-index: 1;
        }
        .card-bottom h4 { font-size: 15px; font-weight: 800; color: #fff; letter-spacing: -0.2px; }
        .card-bottom p { font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 600; }

        .theme-green .card-bg { background: linear-gradient(135deg, #006d3f 0%, #00b84d 50%, #00e87a 100%); }
        .theme-green:hover { box-shadow: 0 30px 60px rgba(0, 232, 122, 0.3); }
        .theme-blue .card-bg { background: linear-gradient(135deg, #0f4db8 0%, #2563eb 50%, #3b8fff 100%); }
        .theme-blue:hover { box-shadow: 0 30px 60px rgba(59, 143, 255, 0.3); }
        .theme-purple .card-bg { background: linear-gradient(135deg, #5b1fa8 0%, #7c3aed 50%, #a855f7 100%); }
        .theme-purple:hover { box-shadow: 0 30px 60px rgba(168, 85, 247, 0.3); }

        /* ── LIST CARDS ── */
        .list-card {
          display: flex; align-items: center; gap: 16px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 20px; padding: 16px 18px; margin: 0 18px 12px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative; overflow: hidden;
          backdrop-filter: blur(20px) saturate(1.2);
          box-shadow: 0 4px 20px var(--shadow);
          opacity: 0;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          text-decoration: none; color: inherit;
        }
        .list-card::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
          background: var(--accent-clr, #00e87a);
          opacity: 0; transition: opacity 0.3s ease;
        }
        .list-card:hover {
          transform: translateY(-4px) translateX(6px) scale(1.02);
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 20px 50px var(--shadow), 0 0 0 1px rgba(255,255,255,0.05);
        }
        .list-card:hover::before { opacity: 1; }
        .list-card:active { transform: scale(0.98); }

        .list-icon {
          width: 56px; height: 56px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; position: relative; overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .list-card:hover .list-icon { transform: scale(1.1) rotate(-6deg); }

        .list-info { flex: 1; min-width: 0; }
        .list-info h4 { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; }
        .list-info p { font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 3px; }

        .list-action {
          width: 38px; height: 38px; border-radius: 50%;
          border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          position: relative; overflow: hidden;
        }
        .list-action:hover { transform: scale(1.2); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
        .list-action:active { transform: scale(0.9); }
        .list-action svg { width: 14px; height: 14px; fill: #000; }

        /* ── SUBJECT CARDS ── */
        .subject-grid { display: grid; gap: 0; }
        .subject-card {
          display: flex; align-items: center; gap: 14px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 20px; padding: 16px 18px; margin: 0 18px 12px;
          text-decoration: none; color: inherit;
          position: relative; overflow: hidden;
          backdrop-filter: blur(20px) saturate(1.2);
          box-shadow: 0 8px 24px var(--shadow);
          transition: all 0.3s ease;
        }
        .subject-card::before {
          content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          border-radius: 3px 0 0 3px;
          background: var(--accent-clr, #00e87a);
        }
        .subject-icon {
          width: 50px; height: 50px; border-radius: 16px;
          background: var(--surface);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--text);
        }
        .subject-info { flex: 1; min-width: 0; }
        .subject-info h3 { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; }
        .subject-info p { font-size: 12px; color: var(--muted); font-weight: 600; margin-top: 3px; }
        .subject-arrow {
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--accent-clr, #00e87a);
          flex-shrink: 0;
          box-shadow: 0 8px 18px rgba(0,0,0,0.22);
        }
        .subject-arrow svg { width: 16px; height: 16px; stroke: #000; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }

        /* ── ANIMATIONS ── */
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ripple { to { transform: scale(3); opacity: 0; } }
        @keyframes clockSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes clockPulse { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
        @keyframes clockGlow {
          0%, 100% { filter: drop-shadow(0 0 2px rgba(255,61,90,0.5)); }
          50% { filter: drop-shadow(0 0 8px rgba(255,61,90,0.8)); }
        }
        @keyframes robotFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes scanBeam { 0% { transform: translateX(-8px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateX(8px); opacity: 0; } }
        @keyframes antennaPulse { 0%, 100% { fill: #00d4ff; filter: drop-shadow(0 0 2px #00d4ff); } 50% { fill: #fff; filter: drop-shadow(0 0 6px #00d4ff); } }
        @keyframes barRise { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.15); } }
        @keyframes arrowBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes iconFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-3px) rotate(3deg); } }
        @keyframes iconPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }
        @keyframes iconSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes iconShake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
        @keyframes foxTail { 0%,100% { transform: rotate(-10deg) translateX(0); } 50% { transform: rotate(20deg) translateX(6px); } }
        @keyframes foxEarLeft { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(-12deg); } 96% { transform: rotate(6deg); } }
        @keyframes foxEarRight { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(12deg); } 96% { transform: rotate(-6deg); } }
        @keyframes foxBlink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } }
        @keyframes foxBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      `}</style>

      <div className="page-root">
        <div className="app">

          {/* ── HEADER ── */}
          <header className="header">
            <div className="header-left">
              <div className="avatar-wrap">🎓</div>
              <div className="user-info">
                <h2>Hello, Alice!</h2>
                <span>Level 4</span>
              </div>
            </div>
            <div className="header-icons">
              <button
                className="icon-btn"
                title="Search"
                onClick={() => { setSearchOpen(true); setSearchQuery(''); }}
              >
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </button>
              <button
                className="icon-btn"
                title="Toggle theme"
                onClick={() => setIsDark((d) => !d)}
              >
                <svg viewBox="0 0 24 24">
                  {isDark
                    ? <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor" stroke="none" />
                    : <>
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </>
                  }
                </svg>
              </button>
              <button className="icon-btn notif-btn" title="Notifications">
                <svg viewBox="0 0 24 24">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── SEARCH OVERLAY ── */}
          <div className={`search-overlay${searchOpen ? ' active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) { setSearchOpen(false); setSearchQuery(''); } }}>
            <div className="search-box">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search quiz modes…"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button className="search-close-btn" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
            </div>
            <div className="search-results">
              {filteredModes.length > 0
                ? filteredModes.map((m) => (
                    <div key={m.name} className="search-result-item">
                      <div className="s-icon">{m.icon}</div>
                      <span>{m.name}</span>
                    </div>
                  ))
                : <div className="search-result-item"><div className="s-icon">🔍</div><span>No results found</span></div>
              }
            </div>
          </div>

          {/* ── HERO ── */}
          <div className="hero">
            <div className="hero-inner">
              <div className="hero-text">
                <h1>Study Smart.<br />Rank Higher.</h1>
                <p>10 Pro modes for SSC · CAT · UPSC</p>
                <button className="hero-btn" onClick={() => alert('🚀 Launching Exam Simulation Mode...')}>
                  Start Now
                </button>
              </div>
              <div className="hero-mascot">
                <FoxMascot />
              </div>
            </div>
          </div>

          {/* ── FEATURED MODES ── */}
          <div className="section-head">
            <h3>Featured Modes</h3>
            <button className="see-all">See All</button>
          </div>

          <div className="scroll-row">
            {featuredModes.map((mode, i) => (
              <div
                key={mode.title}
                className={`mode-card theme-${mode.theme}`}
                style={{ animationDelay: `${0.05 + i * 0.05}s` }}
                onMouseMove={handleTiltMove}
                onMouseLeave={handleTiltLeave}
              >
                <div className="card-bg" />
                <div className="card-mascot">
                  {mode.mascot === 'clock' && <ClockMascot />}
                  {mode.mascot === 'robot' && <RobotMascot />}
                  {mode.mascot === 'graph' && <GraphMascot />}
                </div>
                <div className="card-content">
                  <div className="card-badge">{mode.badge}</div>
                  <div className="card-bottom">
                    <h4>{mode.title}</h4>
                    <p>{mode.copy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── ALL 10 MODES ── */}
          <div className="section-head">
            <h3>All Quiz Modes</h3>
            <button className="see-all see-all-blue" style={{ color: '#3b8fff' }}>Filter</button>
          </div>

          {allModes.map((mode, i) => (
            <Link
              key={mode.title}
              href={mode.href}
              className="list-card"
              style={{ '--accent-clr': mode.accent, animationDelay: `${0.05 + i * 0.03}s` } as React.CSSProperties}
              onClick={handleRipple}
            >
              <div className="list-icon" style={{ background: mode.gradient }}>
                <ListIcon icon={mode.icon} />
              </div>
              <div className="list-info">
                <h4>{mode.title}</h4>
                <p>{mode.copy}</p>
              </div>
              <button
                className="list-action"
                style={{ background: mode.accent }}
                onClick={(e) => e.preventDefault()}
              >
                <svg viewBox="0 0 24 24"><polygon points="8 5 19 12 8 19" /></svg>
              </button>
            </Link>
          ))}

          {/* ── QUICK START ── */}
          <div className="section-head">
            <h3>Quick Start</h3>
            <button className="see-all">Jump In</button>
          </div>

          <div className="subject-grid">
            {subjectCards.map((subject) => (
              <Link
                key={subject.title}
                href={subject.href}
                className="subject-card"
                style={{ '--accent-clr': subject.accent } as React.CSSProperties}
              >
                <div className="subject-icon">
                  <SubjectIcon title={subject.title} />
                </div>
                <div className="subject-info">
                  <h3>{subject.title}</h3>
                  <p>{subject.copy}</p>
                </div>
                <div className="subject-arrow">
                  <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ height: 24 }} />
        </div>
      </div>
    </div>
  );
}