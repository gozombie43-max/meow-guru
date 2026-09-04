'use client';

import React from 'react';
import MathIcon from '@/components/MathIcon';
import ReasoningIcon from '@/components/ReasoningIcon';
import EnglishIcon from '@/components/EnglishIcon';
import GkIcon from '@/components/GkIcon';

interface IconBadgeProps {
  size?: number;
  className?: string;
}

export function MathSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.12) 0%, rgba(20, 91, 199, 0.06) 100%)',
        border: '1px solid rgba(0, 122, 255, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(0, 122, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      aria-hidden="true"
    >
      <MathIcon size={iconSize} />
    </div>
  );
}

export function ReasoningSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, rgba(255, 97, 129, 0.14) 0%, rgba(196, 31, 64, 0.06) 100%)',
        border: '1px solid rgba(255, 97, 129, 0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(242, 68, 114, 0.12)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      aria-hidden="true"
    >
      <ReasoningIcon size={iconSize} />
    </div>
  );
}

export function EnglishSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, rgba(255, 196, 0, 0.14) 0%, rgba(255, 18, 0, 0.06) 100%)',
        border: '1px solid rgba(255, 196, 0, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(255, 196, 0, 0.12)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      aria-hidden="true"
    >
      <EnglishIcon size={iconSize} />
    </div>
  );
}

export function GkSubjectIcon({ size = 48, className = '' }: IconBadgeProps) {
  const iconSize = Math.round(size * 0.72);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: 'linear-gradient(135deg, rgba(37, 61, 153, 0.12) 0%, rgba(137, 196, 33, 0.08) 100%)',
        border: '1px solid rgba(45, 91, 196, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(45, 91, 196, 0.12)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      aria-hidden="true"
    >
      <GkIcon size={iconSize} />
    </div>
  );
}
