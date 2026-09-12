'use client';

import type { CSSProperties } from 'react';
import styles from './ShinyPill.module.css';

export interface ShinyPillProps {
  text?: string;
  link?: string;
  textColor?: string;
  shineColor?: string;
  speed?: number;
  font?: CSSProperties;
  style?: CSSProperties;
  className?: string;
}

export default function ShinyPill(props: ShinyPillProps) {
  const {
    text = 'MOCK & PYQ',
    link,
    textColor,
    shineColor,
    speed = 2.6,
    font,
    style,
    className,
  } = props;

  const isFixedWidth = style?.width === '100%';

  const customStyle: CSSProperties = {
    ...style,
    ...(isFixedWidth ? {} : { minWidth: 'max-content', width: 'auto' }),
    ...(speed ? { ['--shiny-speed' as string]: `${speed}s` } : {}),
    ...font,
  };

  const customBaseStyle: CSSProperties = textColor ? { color: textColor } : {};
  const customShineStyle: CSSProperties = shineColor
    ? {
        background: `linear-gradient(115deg, transparent 0%, transparent 25%, ${shineColor} 45%, #ffffff 50%, ${shineColor} 55%, transparent 75%, transparent 100%)`,
        backgroundSize: '250% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: `drop-shadow(0 0 8px ${shineColor})`,
      }
    : {};

  const content = (
    <span
      style={customStyle}
      className={`${styles.shinyWrapper} ${className || ''}`}
    >
      <span className={styles.baseText} style={customBaseStyle}>
        {text}
      </span>
      <span
        className={styles.shineLayer}
        style={customShineStyle}
        aria-hidden="true"
      >
        {text}
      </span>
    </span>
  );

  if (link) {
    return (
      <a
        href={link}
        style={{ textDecoration: 'none', display: 'inline-flex' }}
      >
        {content}
      </a>
    );
  }

  return content;
}
