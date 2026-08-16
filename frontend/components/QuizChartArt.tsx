'use client';

import React from 'react';

interface QuizChartArtProps {
  size?: number;
  className?: string;
  variant?: 'primary' | 'reasoning' | 'gk';
}

export default function QuizChartArt({
  size = 48,
  className = '',
}: QuizChartArtProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bar-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          <linearGradient id="bar-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>
          <linearGradient id="bar-purple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          <linearGradient id="bar-pink" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F472B6" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>
          <linearGradient id="bar-orange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>
          <filter id="soft-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Bar 1 (Shortest - Cyan) */}
        <g filter="url(#soft-glow)">
          <rect x="8" y="40" width="7" height="18" rx="3.5" fill="url(#bar-cyan)" />
          {/* Accent tip */}
          <rect x="8" y="38" width="7" height="4" rx="2" fill="#BAE6FD" />
        </g>

        {/* Bar 2 (Medium - Yellow) */}
        <g filter="url(#soft-glow)">
          <rect x="20" y="30" width="7" height="28" rx="3.5" fill="url(#bar-yellow)" />
          {/* Accent tip */}
          <rect x="20" y="28" width="7" height="4" rx="2" fill="#FEF08A" />
        </g>

        {/* Bar 3 (Tall - Purple/Blue) */}
        <g filter="url(#soft-glow)">
          <rect x="32" y="20" width="7" height="38" rx="3.5" fill="url(#bar-purple)" />
          {/* Accent tip */}
          <rect x="32" y="18" width="7" height="4" rx="2" fill="#E9D5FF" />
        </g>

        {/* Bar 4 (Tallest - Pink/Magenta Pencil Tip) */}
        <g filter="url(#soft-glow)">
          <rect x="44" y="10" width="8" height="48" rx="4" fill="url(#bar-pink)" />
          {/* Pencil cone tip */}
          <path d="M44 14L48 4L52 14Z" fill="#FDE047" />
          <path d="M47 4L48 2L49 4Z" fill="#1E293B" />
        </g>

        {/* Sparkles / dynamic dots */}
        <circle cx="56" cy="12" r="2" fill="#38BDF8" opacity="0.8" />
        <circle cx="12" cy="32" r="1.5" fill="#C084FC" opacity="0.7" />
        <circle cx="28" cy="18" r="1.5" fill="#FDE047" opacity="0.85" />
      </svg>
    </div>
  );
}
