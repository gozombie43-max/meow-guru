'use client';

import ExamModeSwitch from '@/components/ExamModeSwitch';
import { useModalSurface } from '@/components/ui/Dialog';
import ExamHomeContent from '@/components/ExamHomeContent';
import { useExamMode } from '@/context/ExamModeContext';
import { AiChatIcon } from '@/components/AiChatIcon';
import NotificationBell from '@/components/NotificationBell';
import UserProfileMenu from '@/components/UserProfileMenu';
import { useAuth } from '@/context/AuthContext';
import { useThemeMode } from '@/hooks/useTheme';
import {
  BookOpen,
  FileCheck2,
  ArrowUpRight,
  Home as HomeIcon,
  Menu,
  MessageSquare,
  Moon,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import d from './home-desktop.module.css';
import styles from './page.module.css';

const BRAND_PATH =
  'M56,41.7c0,0 -2.11,-0.54 -4,-0.7c0,0 1.22,1.92 1.5,4.5c0,0 -2.26,-0.55 -4.42,-0.5c0,0 1.62,1.91 1.92,4c0,0 -1.915,1.62 -6.315,4.12c0,0 -0.073,-2.17 -1.185,-6.12h-2c0,0 -0.068,4.899 -1.5,10.3c-3,3.7 -8,3.7 -8,3.7c0,0 -5,0 -8,-3.7c-1.432,-5.401 -1.5,-10.3 -1.5,-10.3h-2c-1.111,3.95 -1.185,6.12 -1.185,6.12c-4.4,-2.5 -6.315,-4.12 -6.315,-4.12c0.3,-2.09 1.92,-4 1.92,-4c-2.16,-0.05 -4.42,0.5 -4.42,0.5c0.28,-2.58 1.5,-4.5 1.5,-4.5c-1.89,0.16 -4,0.7 -4,0.7c0.36,-2.4 2,-4.7 2,-4.7c-2.41,0.27 -4,1 -4,1c3,-14 15,-21 15,-21c-4.02,-4.35 -7.4,-7 -7.4,-7c0,0 -1.17,4.47 -0.6,10.4l-4,4.1c-1,-9.5 1.8,-20.5 1.8,-20.5l1.5,-0.5l12.7,10.5c0,0 2.46,-0.48 7,-0.48c4.54,0 7,0.48 7,0.48l12.7,-10.5l1.5,0.5c0,0 2.8,11 1.8,20.5l-4,-4.1c0.57,-5.93 -0.6,-10.4 -0.6,-10.4c0,0 -3.38,2.65 -7.4,7c0,0 12,7 15,21c0,0 -1.59,-0.73 -4,-1c0,0 1.64,2.3 2,4.7zM26.799,38c-0.143,-2.57 -1.082,-3.92 -1.614,-4.38c-1.741,-0.59 -3.813,-0.58 -5.185,-0.43c2.15,4.75 6.297,4.81 6.348,4.81zM37.652,38c0.051,0 4.198,-0.06 6.348,-4.81c-1.372,-0.15 -3.444,-0.16 -5.185,0.43c-0.532,0.46 -1.471,1.81 -1.614,4.38zM32,52c-2,0 -4,1 -4,1c1,4 4,4 4,4c0,0 3,0 4,-4c0,0 -2,-1 -4,-1z';

const railItems = [
  { label: 'Home', href: '/', icon: HomeIcon, desktopIcon: HomeIcon },
  { label: 'Mock Tests', href: '/mock-test', icon: FileCheck2, desktopIcon: FileCheck2 },
  { label: 'Books & Notes', href: '/resource', icon: BookOpen, desktopIcon: BookOpen },
  { label: 'AI Chat', href: '/ai-chat', icon: AiChatIcon, desktopIcon: MessageSquare },
  { label: 'Profile', href: '/profile', icon: UserRound, desktopIcon: UserRound },
] as const;

function DesktopHelpCard() {
  return (
    <section className={d.help} aria-label="Contact Admin: Guru Charan Murmu">
      <div className={d.helpPerson}>
        <Image className={d.helpAvatar} src="/images/admin-portrait-wide.webp" alt="" width={36} height={36} />
        <div>
          <h2>Guru Charan Murmu</h2>
          <p>Your admin</p>
        </div>
      </div>
      <p className={d.helpCopy}>Have a question or an idea? Reach out directly.</p>
      <a
        className={d.helpPrimary}
        href={adminContacts[0].href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact Guru Charan Murmu on WhatsApp (opens in a new tab)"
      >
        <span>Message on WhatsApp</span>
        <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
      </a>
      <div className={d.helpLinks}>
        {adminContacts.slice(1).map((contact) => (
          <a
            key={contact.label}
            href={contact.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Contact Guru Charan Murmu on ${contact.label} (opens in a new tab)`}
          >
            <span>{contact.label}</span>
            <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}

const adminContacts = [
  { label: 'WhatsApp', href: 'https://wa.me/919064084753', icon: '/icons8-whatsapp.svg' },
  { label: 'Instagram', href: 'https://www.instagram.com/guru__charan7/', icon: '/icons8-instagram-logo.svg' },
  { label: 'Telegram', href: 'https://t.me/gurucharan123', icon: '/icons8-telegram-logo.svg' },
] as const;

function AdminContactCard() {
  return <section className={styles.adminContactCard} aria-label="Contact Admin: Guru Charan Murmu">
    <p className={styles.contactEyebrow}>Here to help</p>
    <div className={styles.contactIdentity}>
      <Image className={styles.contactAvatar} src="/images/admin-portrait-wide.webp" alt="" width={36} height={36} />
      <div>
        <h2>Guru Charan Murmu</h2>
        <p className={styles.contactRole}>Your admin</p>
      </div>
    </div>
    <p className={styles.contactDescription}>Have a question or an idea?<br /><span>Get in touch directly.</span></p>
    <a className={styles.contactWhatsapp} href={adminContacts[0].href} target="_blank" rel="noopener noreferrer" aria-label="Contact Guru Charan Murmu on WhatsApp (opens in a new tab)">
      <Image src={adminContacts[0].icon} alt="" width={24} height={24} />
      <span>Chat on WhatsApp</span><ArrowUpRight size={18} aria-hidden="true" />
    </a>
    <div className={styles.contactDivider}>Or reach me on</div>
    <div className={styles.contactLinks}>
      {adminContacts.slice(1).map(contact => <a key={contact.label} href={contact.href} target="_blank" rel="noopener noreferrer" aria-label={`Contact Guru Charan Murmu on ${contact.label} (opens in a new tab)`}>
        <Image src={contact.icon} alt="" width={20} height={20} />
        <span>{contact.label}</span>
        <ArrowUpRight size={12} aria-hidden="true" />
      </a>)}
    </div>
  </section>;
}

function SkillLearnLogo() {
  return (
    <Link href="/" className={styles.logo} aria-label="Study Guru home">
      <span className={styles.logoMark} aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="36" height="36" fillRule="nonzero">
          <g fill="#2563eb" fillRule="nonzero" stroke="none" strokeWidth="1" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10" strokeDasharray="" strokeDashoffset="0" style={{ mixBlendMode: 'normal' }}>
            <g transform="scale(4,4)">
              <path d="M56,41.7c0,0 -2.11,-0.54 -4,-0.7c0,0 1.22,1.92 1.5,4.5c0,0 -2.26,-0.55 -4.42,-0.5c0,0 1.62,1.91 1.92,4c0,0 -1.915,1.62 -6.315,4.12c0,0 -0.073,-2.17 -1.185,-6.12h-2c0,0 -0.068,4.899 -1.5,10.3c-3,3.7 -8,3.7 -8,3.7c0,0 -5,0 -8,-3.7c-1.432,-5.401 -1.5,-10.3 -1.5,-10.3h-2c-1.111,3.95 -1.185,6.12 -1.185,6.12c-4.4,-2.5 -6.315,-4.12 -6.315,-4.12c0.3,-2.09 1.92,-4 1.92,-4c-2.16,-0.05 -4.42,0.5 -4.42,0.5c0.28,-2.58 1.5,-4.5 1.5,-4.5c-1.89,0.16 -4,0.7 -4,0.7c0.36,-2.4 2,-4.7 2,-4.7c-2.41,0.27 -4,1 -4,1c3,-14 15,-21 15,-21c-4.02,-4.35 -7.4,-7 -7.4,-7c0,0 -1.17,4.47 -0.6,10.4l-4,4.1c-1,-9.5 1.8,-20.5 1.8,-20.5l1.5,-0.5l12.7,10.5c0,0 2.46,-0.48 7,-0.48c4.54,0 7,0.48 7,0.48l12.7,-10.5l1.5,0.5c0,0 2.8,11 1.8,20.5l-4,-4.1c0.57,-5.93 -0.6,-10.4 -0.6,-10.4c0,0 -3.38,2.65 -7.4,7c0,0 12,7 15,21c0,0 -1.59,-0.73 -4,-1c0,0 1.64,2.3 2,4.7zM26.799,38c-0.143,-2.57 -1.082,-3.92 -1.614,-4.38c-1.741,-0.59 -3.813,-0.58 -5.185,-0.43c2.15,4.75 6.297,4.81 6.348,4.81zM37.652,38c0.051,0 4.198,-0.06 6.348,-4.81c-1.372,-0.15 -3.444,-0.16 -5.185,0.43c-0.532,0.46 -1.471,1.81 -1.614,4.38zM32,52c-2,0 -4,1 -4,1c1,4 4,4 4,4c0,0 3,0 4,-4c0,0 -2,-1 -4,-1z"></path>
            </g>
          </g>
        </svg>
      </span>
      <span className={styles.logoText}>
        <strong>STUDY</strong>
        <span>GURU</span>
      </span>
    </Link>
  );
}

export default function HomeClient({
  desktopContent,
  mobileContent,
}: {
  desktopContent: ReactNode;
  mobileContent: ReactNode;
}) {
  const { isJam } = useExamMode();
  const pathname = usePathname() || '/';
  const { user } = useAuth();
  const { theme, toggleThemeMode } = useThemeMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useModalSurface(sidebarRef, sidebarOpen, () => setSidebarOpen(false), { initialFocus: '[aria-label="Close sidebar"]' });
  const isDark = theme === 'dark';

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    document.body.classList.add('home-redesign');
    document.documentElement.classList.add('home-redesign');
    return () => {
      document.body.classList.remove('home-redesign');
      document.documentElement.classList.remove('home-redesign');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderMobileHeaderActions = () => (
    <div className={styles.headerActionsMobile}>
      <NotificationBell />
      <button data-ui-button="state" data-ui-shape="icon"
        type="button"
        className={styles.menuButton}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
        aria-expanded={sidebarOpen}
        aria-controls="home-navigation-drawer"
      >
        <Menu size={30} />
      </button>
    </div>
  );

  return (
    <div className={`${styles.pageWrapper} ${isDark ? styles.dark : ''}`}>
      <div className={styles.desktopOnly}>
        <div className={d.window}>
          <aside className={d.sidebar}>
            <Link href="/" className={d.brand} aria-label="Study Guru home">
              <span className={d.brandMark} aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="22" height="22">
                  <g><path d={BRAND_PATH} /></g>
                </svg>
              </span>
              <span className={d.brandName}>Study <span>Guru</span></span>
            </Link>

            <div className={d.examSlot}>
              <ExamModeSwitch />
            </div>

            <p className={d.navLabel} id="desktop-nav-label">Menu</p>
            <nav className={d.nav} aria-labelledby="desktop-nav-label">
              {railItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.desktopIcon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`${d.navLink} ${active ? d.navActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <DesktopHelpCard />
          </aside>

          <div className={d.workspace}>
            <div className={d.actions}>
              <NotificationBell size={36} iconSize={17} />
              {user ? (
                <UserProfileMenu size={36} align="right" />
              ) : (
                <Link href="/login" className={d.iconBtn} aria-label="Log in" title="Log in">
                  <UserRound size={17} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              )}
            </div>

            {isJam ? <div className={d.jamSlot}><ExamHomeContent /></div> : desktopContent}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE / TABLET VIEW (Previous Mobile Design)
          ========================================================================= */}
      <div className={styles.mobileOnly}>
        {/* Backdrop for mobile drawer */}
        <button
          type="button"
          className={`${styles.sidebarBackdrop} ${sidebarOpen ? styles.sidebarBackdropOpen : ''}`}
          onClick={() => setSidebarOpen(false)}
          onTouchMove={(e) => e.preventDefault()}
          aria-label="Close menu"
          data-dialog-backdrop
          tabIndex={-1}
          aria-hidden={!sidebarOpen}
        />

        {/* Mobile Slide-out Sidebar */}
        <aside ref={sidebarRef} id="home-navigation-drawer" role="dialog" aria-modal={sidebarOpen || undefined} aria-label="Main menu" aria-hidden={!sidebarOpen} inert={!sidebarOpen} tabIndex={-1} className={`${styles.mobileSidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.mobileSidebarHeader}>
            <SkillLearnLogo />
            <button data-ui-button="state" data-ui-shape="icon"
              type="button"
              className={styles.sidebarCloseButton}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={22} />
            </button>
          </div>

          <section className={styles.sidebarPreferences} aria-label="Preferences">
            <button data-ui-exam-switch="true"
              type="button"
              className={styles.sidebarThemeToggle}
              onClick={toggleThemeMode}
              aria-label="Dark mode"
              role="switch"
              aria-checked={isDark}
            >
              <span className={styles.sidebarThemeIcon} aria-hidden="true">
                {isDark ? <Moon size={20} /> : <Sun size={20} />}
              </span>
              <span>Dark mode</span>
              <span className={styles.sidebarThemeSwitch} aria-hidden="true">
                <span />
              </span>
            </button>
            <ExamModeSwitch />
          </section>
          <nav className={styles.railNav} aria-label="Primary Mobile">
            <p className={styles.sidebarSectionLabel}>Workspace</p>
            {railItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${styles.railLink} ${active ? styles.railActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon size={20} strokeWidth={active ? 2.6 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <AdminContactCard />
        </aside>

        {/* Mobile Page Content */}
        <div className={styles.mobileWorkspace}>
          <header data-ui-chrome="header" className={styles.mobileTopbar}>
            <SkillLearnLogo />
            {renderMobileHeaderActions()}
          </header>

          <div className={styles.mobileScrollContent}>
            {isJam ? <ExamHomeContent /> : mobileContent}
          </div>
        </div>
      </div>
    </div>
  );
}
