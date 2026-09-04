import React from 'react';
import styles from './GoogleAvatarRing.module.css';

interface GoogleAvatarRingProps {
  initial?: string;
  avatarUrl?: string;
  size?: number;
  className?: string;
}

export default function GoogleAvatarRing({
  initial = 'G',
  avatarUrl,
  size = 40,
  className = '',
}: GoogleAvatarRingProps) {
  // SVG coordinates: centered at (24, 24), radius = 21, strokeWidth = 3.2
  // 4 segments with rounded linecaps and slight spacing:
  // Red (top): 316 deg to 404 deg (span 88 deg)
  // Blue (right): 46 deg to 134 deg (span 88 deg)
  // Green (bottom): 136 deg to 224 deg (span 88 deg)
  // Yellow (left): 226 deg to 314 deg (span 88 deg)
  
  const cx = 24;
  const cy = 24;
  const r = 21;

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  // Precise Google Colors from reference
  const RED = '#EA4335';
  const BLUE = '#4285F4';
  const GREEN = '#34A853';
  const YELLOW = '#FBBC05';

  const redPath = describeArc(cx, cy, r, 322, 360 + 38); // Top Red arc
  const bluePath = describeArc(cx, cy, r, 52, 128);      // Right Blue arc
  const greenPath = describeArc(cx, cy, r, 142, 218);    // Bottom Green arc
  const yellowPath = describeArc(cx, cy, r, 232, 308);   // Left Yellow arc

  return (
    <div
      className={`${styles.container} ${className}`}
      style={{ width: size, height: size, fontSize: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        className={styles.ringSvg}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={redPath}
          stroke={RED}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d={bluePath}
          stroke={BLUE}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d={greenPath}
          stroke={GREEN}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d={yellowPath}
          stroke={YELLOW}
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
      <div className={styles.innerBadge}>
        {avatarUrl ? (
          <span
            className={styles.avatarImg}
            style={{ backgroundImage: `url("${avatarUrl}")` }}
          />
        ) : (
          <span className={styles.initialText}>{initial}</span>
        )}
      </div>
    </div>
  );
}
