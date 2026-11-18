'use client';

import { type ReactNode } from 'react';
import styles from './mobile-hero-carousel.module.css';

export default function MobileHeroCarousel({ children }: { children: ReactNode }) {
  return (
    <div className={styles.carousel} data-hero-banner="true">
      {children}
    </div>
  );
}
