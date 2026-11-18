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
import GuestWelcomeScreen from './GuestWelcomeScreen';
import d from './home-desktop.module.css';
import styles from './page.module.css';

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
    <Link href="/" className={styles.logo} aria-label="Meow home">
      <Image
        src="/images/meow-logo.webp"
        alt="Meow"
        width={76}
        height={38}
        priority
        unoptimized
        className={styles.meowBrandImg}
      />
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
  const { user, loading } = useAuth();
  const { theme, toggleThemeMode } = useThemeMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heroScrolled, setHeroScrolled] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const showGuestWelcome = !loading && !user;
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
    if (showGuestWelcome) return;
    document.body.classList.add('home-redesign');
    document.documentElement.classList.add('home-redesign');
    return () => {
      document.body.classList.remove('home-redesign');
      document.documentElement.classList.remove('home-redesign');
    };
  }, [showGuestWelcome]);

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

  if (showGuestWelcome) {
    return <GuestWelcomeScreen />;
  }

  return (
    <div className={`${styles.pageWrapper} ${isDark ? styles.dark : ''}`}>
      <div className={styles.desktopOnly}>
        <div className={d.window}>
          <aside className={d.sidebar}>
            <Link href="/" className={d.brand} aria-label="Meow home">
              <Image
                src="/images/meow-logo.webp"
                alt="Meow"
                width={72}
                height={36}
                priority
                unoptimized
                className={d.brandLogoImg}
              />
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
        <div className={`${styles.mobileWorkspace} ${!isJam ? styles.heroWorkspace : ''}`}>
          <header data-ui-chrome="header" data-scrolled={!isJam && heroScrolled ? 'true' : undefined} className={`${styles.mobileTopbar} ${!isJam ? styles.topbarOverlay : ''}`}>
            <SkillLearnLogo />
            {renderMobileHeaderActions()}
          </header>

          <div className={styles.mobileScrollContent} onScroll={isJam ? undefined : event => setHeroScrolled(event.currentTarget.scrollTop > 140)}>
            {isJam ? <ExamHomeContent /> : mobileContent}
          </div>
        </div>
      </div>
    </div>
  );
}
