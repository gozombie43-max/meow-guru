'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Zap, Target, ShieldCheck } from 'lucide-react';
import WolfIcon from '@/components/WolfIcon';
import styles from './auth.module.css';

interface AuthCardProps {
  title: string;
  subtitle: string;
  activeTab: 'login' | 'register';
  error?: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkHref?: string;
}

export default function AuthCard({
  title,
  subtitle,
  activeTab,
  error,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthCardProps) {
  const isLogin = activeTab === 'login';

  return (
    <main className={styles.authContainer}>
      {/* Main Dual-Pane Apple Glass Shell */}
      <div className={styles.authShell}>
        {/* Left Showcase Pane (Visible on PC Desktop) */}
        <aside className={styles.pcShowcase}>
          <div>
            <Link href="/" className={styles.showcaseBrand} aria-label="Go to Meow home">
              <div className={styles.brandSquircle}>
                <WolfIcon size={32} fillColor="#ffffff" />
              </div>
              <div className={styles.brandTextGroup}>
                <span className={styles.brandTitleText}>Meow</span>
                <span className={styles.brandTaglineText}>SSC Exam Prep</span>
              </div>
            </Link>

            <div className={styles.showcaseHero}>
              <h2 className={styles.showcaseHeading}>
                {isLogin
                  ? 'Study smarter.\nRank higher.'
                  : 'Start your journey to\nAll India Rank.'}
              </h2>
              <p className={styles.showcaseSubheading}>
                {isLogin
                  ? 'Sign in to resume your daily streak, personalized quizzes, and accuracy analytics.'
                  : 'Create your account to access AI-calibrated practice drills and comprehensive PYQs.'}
              </p>
            </div>

            <div className={styles.showcasePills}>
              <div className={styles.showcasePill}>
                <div className={styles.pillIconWrap}>
                  <Zap size={15} />
                </div>
                <span>Adaptive Practice Engine</span>
              </div>
              <div className={styles.showcasePill}>
                <div className={styles.pillIconWrap}>
                  <Target size={15} />
                </div>
                <span>Targeted Topic-wise Drills</span>
              </div>
              <div className={styles.showcasePill}>
                <div className={styles.pillIconWrap}>
                  <ShieldCheck size={15} />
                </div>
                <span>Real-time Accuracy Diagnostics</span>
              </div>
            </div>
          </div>

          <div className={styles.showcaseFooter}>
            <span>256-bit SSL Encrypted • Private &amp; Secure</span>
          </div>
        </aside>

        {/* Right Form Card Pane (Desktop & Mobile) */}
        <section className={styles.authCard}>
          {/* Mobile Header (Shown only on mobile when showcase is hidden) */}
          <div data-ui-chrome="header" className={styles.mobileCardHeader}>
            <Link href="/" className={styles.brandSquircle} aria-label="Return to home">
              <WolfIcon size={34} fillColor="#ffffff" />
            </Link>
            <h1 className={styles.brandTitle}>{title}</h1>
            <p className={styles.brandSubtitle}>{subtitle}</p>
          </div>

          {/* Desktop Header (Shown on desktop) */}
          <div data-ui-chrome="header" className={styles.desktopCardHeader}>
            <h1 className={styles.brandTitle}>{title}</h1>
            <p className={styles.brandSubtitle}>{subtitle}</p>
          </div>

          {/* iOS Segmented Switcher */}
          <div className={styles.segmentedControl} role="tablist" aria-label="Authentication mode">
            <Link
              href="/login"
              role="tab"
              aria-selected={activeTab === 'login'}
              className={`${styles.segmentedTab} ${activeTab === 'login' ? styles.segmentedTabActive : ''}`}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              role="tab"
              aria-selected={activeTab === 'register'}
              className={`${styles.segmentedTab} ${activeTab === 'register' ? styles.segmentedTabActive : ''}`}
            >
              Create Account
            </Link>
          </div>

          {/* Error Alert */}
          {error && (
            <div className={styles.alertBanner} role="alert">
              <AlertCircle size={16} />
              <div>{error}</div>
            </div>
          )}

          {/* Form Body */}
          {children}

          {/* Card Footer Link */}
          {footerText && footerLinkText && footerLinkHref && (
            <div data-ui-chrome="footer" className={styles.cardFooter}>
              <span>{footerText}</span>
              <Link href={footerLinkHref} className={styles.footerLink}>
                {footerLinkText}
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
