'use client';

import React from 'react';

interface IconBadgeProps {
  size?: number;
  className?: string;
}

export function MathSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
        <path d="M6.5 4.5v4M4.5 6.5h4" stroke="currentColor" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
        <path d="M15.5 6.5h4" stroke="currentColor" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
        <path d="M5 16l3 3M8 16l-3 3" stroke="currentColor" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
        <path d="M15.5 16.5h4M15.5 18.5h4" stroke="currentColor" />
      </svg>
    </div>
  );
}

export function ReasoningSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)',
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Brain with lightning */}
        <path d="M9.5 2A4.5 4.5 0 0 0 5 6.5c0 .6.1 1.2.3 1.7A4 4 0 0 0 3 12a4 4 0 0 0 2.5 3.7A4.5 4.5 0 0 0 9.5 20h.5" />
        <path d="M14.5 2A4.5 4.5 0 0 1 19 6.5c0 .6-.1 1.2-.3 1.7A4 4 0 0 1 21 12a4 4 0 0 1-2.5 3.7A4.5 4.5 0 0 1 14.5 20h-.5" />
        {/* Lightning bolts */}
        <path d="M12 4v4l-2 3h4l-2 5" stroke="#FDE047" strokeWidth="2" strokeLinejoin="miter" />
      </svg>
    </div>
  );
}

export function EnglishSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(30, 64, 175, 0.25)',
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="6" x2="16" y2="6" stroke="#BAE6FD" strokeWidth="1.5" />
        <line x1="8" y1="10" x2="16" y2="10" stroke="#BAE6FD" strokeWidth="1.5" />
        <line x1="8" y1="14" x2="13" y2="14" stroke="#BAE6FD" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function GkSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'linear-gradient(135deg, #0D9488 0%, #047857 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(4, 120, 87, 0.25)',
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="10" r="7" stroke="#ffffff" />
        <ellipse cx="12" cy="10" rx="3.5" ry="7" stroke="#6EE7B7" strokeWidth="1.2" />
        <line x1="5.5" y1="8" x2="18.5" y2="8" stroke="#6EE7B7" strokeWidth="1.2" />
        <line x1="5.5" y1="12" x2="18.5" y2="12" stroke="#6EE7B7" strokeWidth="1.2" />
        <path d="M3 20c3-1 6-1 9 1 3-2 6-2 9-1" stroke="#FDE047" strokeWidth="2" />
      </svg>
    </div>
  );
}
