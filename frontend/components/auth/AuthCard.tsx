'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import WolfIcon from '@/components/WolfIcon';
import { ConfigurationTemplate } from '@/design-system';
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
  showNavigationTabs?: boolean;
}

function AuthCard({
  title,
  subtitle,
  activeTab,
  error,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
  showNavigationTabs = true,
}: AuthCardProps) {
  return (
    <ConfigurationTemplate
      variant="auth"
      maxWidth={440}
      showNavRail={false}
      showBottomNav={false}
    >
      <section className={styles.authCard} data-page-content>
        {/* Mobile Header */}
        <div className={styles.mobileCardHeader}>
          <Link href="/" prefetch={false} className={styles.brandSquircle} aria-label="Return to home">
            <WolfIcon size={34} fillColor="#ffffff" />
          </Link>
          <h1 className={styles.brandTitle}>{title}</h1>
          <p className={styles.brandSubtitle}>{subtitle}</p>
        </div>

        {/* Desktop Header */}
        <div className={styles.desktopCardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Link href="/" prefetch={false} className={styles.brandSquircle} aria-label="Return to home">
              <WolfIcon size={30} fillColor="#ffffff" />
            </Link>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--meow-accent)', textTransform: 'uppercase' }}>Meow Prep</span>
            </div>
          </div>
          <h1 className={styles.brandTitle}>{title}</h1>
          <p className={styles.brandSubtitle}>{subtitle}</p>
        </div>

        {/* Segmented Switcher */}
        {showNavigationTabs && (
          <nav className={styles.segmentedControl} aria-label="Authentication mode">
            <Link
              href="/login"
              prefetch={false}
              aria-current={activeTab === 'login' ? 'page' : undefined}
              className={`${styles.segmentedTab} ${activeTab === 'login' ? styles.segmentedTabActive : ''}`}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              prefetch={false}
              aria-current={activeTab === 'register' ? 'page' : undefined}
              className={`${styles.segmentedTab} ${activeTab === 'register' ? styles.segmentedTabActive : ''}`}
            >
              Create Account
            </Link>
          </nav>
        )}

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
          <div className={styles.cardFooter}>
            <span>{footerText}</span>
            <Link href={footerLinkHref} prefetch={false} className={styles.footerLink}>
              {footerLinkText}
            </Link>
          </div>
        )}
      </section>
    </ConfigurationTemplate>
  );
}

export default React.memo(AuthCard);
