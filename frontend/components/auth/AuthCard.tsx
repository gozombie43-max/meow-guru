'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
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
  showNavigationTabs = false,
}: AuthCardProps) {
  return (
    <ConfigurationTemplate
      variant="auth"
      maxWidth={440}
      showNavRail={false}
      showBottomNav={false}
    >
      <section className={styles.authCard} data-auth-container="outlined" data-page-content>
        <header className={styles.cardHeader}>
          <Link href="/" prefetch={false} className={styles.brandLogoLink} aria-label="Return to home">
            <Image
              src="/images/meow-logo.webp"
              alt="Meow"
              width={156}
              height={78}
              priority
              unoptimized
              className={styles.meowBrandLogo}
            />
          </Link>
          <h1 className={styles.brandTitle}>{title}</h1>
          <p className={styles.brandSubtitle}>{subtitle}</p>
        </header>

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
