'use client';

import { useThemeMode } from '@/hooks/useTheme';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import styles from './GuestWelcomeScreen.module.css';

function PracticeBoltIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="welcome-bolt" x1="14" y1="2" x2="14" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <path
        d="M15.8 2.5L6.2 15.4h7.1l-1.9 10.1 10.4-13.4h-7l1-9.6z"
        fill="url(#welcome-bolt)"
      />
    </svg>
  );
}

function TrackBarsIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="15" width="5" height="9" rx="1.5" fill="#38bdf8" />
      <rect x="11.5" y="10" width="5" height="14" rx="1.5" fill="#34d399" />
      <rect x="19" y="4" width="5" height="20" rx="1.5" fill="#facc15" />
    </svg>
  );
}

function ImproveTrophyIcon() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="welcome-trophy" x1="14" y1="3" x2="14" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path
        d="M8.5 4h11v6.2c0 3.3-2.5 5.9-5.5 5.9s-5.5-2.6-5.5-5.9V4z"
        fill="url(#welcome-trophy)"
      />
      <path
        d="M8.5 6H5.2c0 3.3 1.4 5.2 3.6 5.5M19.5 6h3.3c0 3.3-1.4 5.2-3.6 5.5"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="12.5" y="15.8" width="3" height="4.2" fill="#f59e0b" />
      <rect x="8.8" y="20" width="10.4" height="3.2" rx="1.2" fill="url(#welcome-trophy)" />
    </svg>
  );
}

export default function GuestWelcomeScreen() {
  const { setThemeMode } = useThemeMode();

  useEffect(() => {
    setThemeMode('light');
    document.body.classList.add('guest-welcome-route');
    return () => {
      document.body.classList.remove('guest-welcome-route');
    };
  }, [setThemeMode]);

  return (
    <section className={styles.welcomePage} aria-labelledby="guest-welcome-title">
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 id="guest-welcome-title" className={styles.brandTitle}>
            <Image
              src="/images/meow-logo.webp"
              alt="Meow"
              width={180}
              height={90}
              priority
              unoptimized
              className={styles.brandLogoImg}
            />
          </h1>
          <p className={styles.tagline}>Study Smarter. Go Further.</p>
          <p className={styles.exams}>SSC • RRB • Banking • CAT</p>
        </header>

        <div className={styles.illustrationWrap}>
          <Image
            src="/images/welcome-cat-book-light.webp"
            alt="Cute cat reading a book — Small Steps Big Results"
            width={360}
            height={240}
            priority
            unoptimized
            className={styles.heroIllustration}
          />
        </div>

        <ul className={styles.features} aria-label="Highlights">
          <li className={styles.featureItem}>
            <span className={styles.featureIcon}>
              <PracticeBoltIcon />
            </span>
            <span>Practice</span>
          </li>
          <li className={styles.featureItem}>
            <span className={styles.featureIcon}>
              <TrackBarsIcon />
            </span>
            <span>Track</span>
          </li>
          <li className={styles.featureItem}>
            <span className={styles.featureIcon}>
              <ImproveTrophyIcon />
            </span>
            <span>Improve</span>
          </li>
        </ul>

        <div className={styles.actions}>
          <Link href="/register" className={styles.primaryCta}>
            <span>Get Started</span>
            <ArrowRight size={18} strokeWidth={2.25} aria-hidden="true" />
          </Link>
          <Link href="/login" className={styles.secondaryCta}>
            I already have an account
          </Link>
        </div>

        <p className={styles.quote}>&ldquo;A better you is a few questions away.&rdquo;</p>

        <div className={styles.dots} aria-hidden="true">
          <span className={styles.dotActive} />
          <span className={styles.dotMuted} />
          <span className={styles.dotMuted} />
        </div>
      </div>
    </section>
  );
}
