import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import LegacyBackButtonReexport from '@/components/BackButton';
import {
  AppHeader,
  BackButton,
  BottomNav,
  NavRail,
  PRIMARY_NAV_ITEMS,
  isPrimaryNavItemActive,
} from '@/design-system';

const mockBack = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAppNavigation', () => ({
  useAppNavigation: () => ({
    back: mockBack,
    push: vi.fn(),
    replace: vi.fn(),
    complete: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/mock-test',
}));

const FRONTEND_ROOT = path.resolve(__dirname, '..');

function readFrontend(relPath: string): string {
  return fs.readFileSync(path.join(FRONTEND_ROOT, relPath), 'utf8');
}

describe('P0-D Global Shell Chrome', () => {
  afterEach(() => {
    cleanup();
    mockBack.mockReset();
  });

  describe('BackButton', () => {
    it('wraps Button icon size, stamps back-button marker, and calls onBeforeNavigate before navigation.back', () => {
      const calls: string[] = [];
      mockBack.mockImplementation((href: string) => calls.push(`back:${href}`));

      render(
        <BackButton
          href="/mock-test"
          label="Return to exams"
          className="custom-back"
          onBeforeNavigate={() => calls.push('before')}
        />,
      );

      const button = screen.getByRole('button', { name: 'Return to exams' });
      expect(button).toHaveAttribute('data-meow-component', 'back-button');
      expect(button).toHaveAttribute('data-ui-button', 'state');
      expect(button).toHaveAttribute('data-ui-shape', 'icon');
      expect(button).toHaveAttribute('data-meow-size', 'icon');
      expect(button).toHaveClass('custom-back');

      fireEvent.click(button);
      expect(calls).toEqual(['before', 'back:/mock-test']);
    });

    it('re-exports the canonical BackButton from @/components/BackButton', () => {
      render(<LegacyBackButtonReexport href="/play" />);
      const button = screen.getByRole('button', { name: 'Back' });
      expect(button).toHaveAttribute('data-meow-component', 'back-button');
      fireEvent.click(button);
      expect(mockBack).toHaveBeenCalledWith('/play');
    });
  });

  describe('AppHeader', () => {
    it('renders built-in BackButton, title, subtitle, actions, and variant attributes', () => {
      const onBeforeBack = vi.fn();
      render(
        <AppHeader
          backHref="/mathematics"
          backLabel="Back to Mathematics"
          onBeforeBack={onBeforeBack}
          title="Percentages"
          subtitle="24 questions remaining"
          actions={<button type="button">Filter</button>}
          variant="compact"
          centered
          maxWidth={1080}
        />,
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveAttribute('data-meow-component', 'app-header');
      expect(header).toHaveAttribute('data-meow-variant', 'compact');
      expect(header).toHaveAttribute('data-meow-tokens', '');
      expect(header).toHaveAttribute('data-ui-chrome', 'header');
      expect(screen.getByText('Percentages')).toBeInTheDocument();
      expect(screen.getByText('24 questions remaining')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Back to Mathematics' }));
      expect(onBeforeBack).toHaveBeenCalledTimes(1);
      expect(mockBack).toHaveBeenCalledWith('/mathematics');
    });

    it('supports custom leading slot and transparent variant without BackButton when omitted', () => {
      render(
        <AppHeader
          variant="transparent"
          sticky={false}
          leading={<span>Logo</span>}
          title="Overview"
        />,
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveAttribute('data-meow-variant', 'transparent');
      expect(screen.getByText('Logo')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    });
  });

  describe('NavRail', () => {
    it('renders default primary nav items with exact/prefix active matching and aria-current', () => {
      render(<NavRail pathname="/play/setup-guide" />);
      const nav = screen.getByRole('navigation', { name: 'Primary desktop navigation' });
      expect(nav).toHaveAttribute('data-meow-component', 'nav-rail');
      expect(nav).toHaveAttribute('data-collapsed', 'false');

      const playLink = screen.getByRole('link', { name: 'Play' });
      expect(playLink).toHaveAttribute('aria-current', 'page');
      expect(playLink).toHaveAttribute('data-custom-focus', 'true');
      expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    });

    it('supports collapsed mode, header/footer slots, and badges', () => {
      const { rerender } = render(
        <NavRail
          pathname="/mock-test"
          header={<span>Meow</span>}
          footer={<span>v2</span>}
          items={[
            ...PRIMARY_NAV_ITEMS.slice(0, 2),
          ]}
        />,
      );
      expect(screen.getByText('Meow')).toBeInTheDocument();
      expect(screen.getByText('v2')).toBeInTheDocument();

      rerender(
        <NavRail
          pathname="/"
          collapsed
          items={PRIMARY_NAV_ITEMS.map((item) =>
            item.id === 'mock' ? { ...item, badge: 120 } : item,
          )}
        />,
      );

      const nav = screen.getByRole('navigation', { name: 'Primary desktop navigation' });
      expect(nav).toHaveAttribute('data-collapsed', 'true');
      expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('title', 'Home');
      expect(screen.queryByText('99+')).toBeNull();
    });
  });

  describe('BottomNav pattern', () => {
    it('supports active highlighting, badge capping, and hidden state', () => {
      const { rerender } = render(
        <BottomNav
          pathname="/mock-test/ssc-cgl"
          badges={{ mock: 120, profile: true }}
        />,
      );

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(nav).toHaveAttribute('data-meow-component', 'bottom-nav');
      expect(screen.getByRole('link', { name: 'Mock' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('99+')).toBeInTheDocument();

      rerender(<BottomNav pathname="/" isHidden />);
      expect(nav).toHaveAttribute('aria-hidden', 'true');
      expect(nav).toHaveClass('is-hidden');
      expect(screen.getByRole('link', { name: 'Home', hidden: true })).toHaveAttribute(
        'tabIndex',
        '-1',
      );
    });

    it('evaluates exact and prefix item matching uniformly', () => {
      expect(isPrimaryNavItemActive('/', PRIMARY_NAV_ITEMS[0])).toBe(true);
      expect(isPrimaryNavItemActive('/mock-test', PRIMARY_NAV_ITEMS[0])).toBe(false);
      expect(isPrimaryNavItemActive('/mock-test/ssc-cgl', PRIMARY_NAV_ITEMS[1])).toBe(true);
      expect(isPrimaryNavItemActive('/mock-test-other', PRIMARY_NAV_ITEMS[1])).toBe(false);
    });
  });

  describe('Static shell CSS contracts', () => {
    it('eliminates 1025px breakpoint mismatch and duplicate bottom-pill-nav rules', () => {
      const globals = readFrontend('app/globals.css');
      const dark = readFrontend('app/dark-theme.css');
      const light = readFrontend('app/light-theme.css');
      const iface = readFrontend('app/interface.css');
      const playHub = readFrontend('app/(app)/play/play-hub.css');
      const setupCss = readFrontend('app/(app)/play/setup/[mode]/setup.css');

      expect(globals).not.toContain('1025px');
      expect(globals).not.toContain('nav-active-pulse');
      expect(globals).not.toContain('.bottom-nav-item');
      expect(globals).toContain('@media (min-width: 1024px)');

      expect(dark).not.toContain('.bottom-pill-nav');
      expect(dark).not.toContain('1025px');
      expect(light).not.toContain('.bottom-pill-nav');
      expect(light).not.toContain('1025px');

      expect(iface).not.toContain('.bottom-pill-nav[data-ui-chrome="footer"]');
      expect(iface).toContain(
        '[data-ui-chrome="header"]:where(:not([data-meow-component="app-header"]))',
      );
      expect(iface).toContain(
        '[data-ui-chrome="footer"]:where(:not(.bottom-pill-nav):not([data-meow-component="bottom-nav"]))',
      );
      expect(iface).toContain('[data-meow-component="back-button"]');

      expect(playHub).not.toContain('@media (max-width: 1024px)');
      expect(playHub).toContain('@media (max-width: 1023px)');
      expect(setupCss).not.toContain('@media (max-width: 1024px)');
      expect(setupCss).toContain('@media (max-width: 1023px)');
    });

    it('keeps new shell CSS free of blur, 100vh, transition:all, and sub-12px labels', () => {
      const cssModules = [
        readFrontend('design-system/patterns/BottomNav.module.css'),
        readFrontend('design-system/patterns/AppHeader.module.css'),
        readFrontend('design-system/patterns/NavRail.module.css'),
        readFrontend('design-system/components/BackButton.module.css'),
      ];

      for (const css of cssModules) {
        expect(css).not.toMatch(/backdrop-filter:\s*blur/i);
        expect(css).not.toMatch(/transition:\s*all\b/i);
        expect(css).not.toContain('100vh');
      }

      const bottomNavCss = cssModules[0];
      expect(bottomNavCss).toContain('font-size: var(--meow-text-xs)');
      expect(bottomNavCss).toContain('@media (min-width: 1024px)');
      expect(bottomNavCss).toContain('prefers-reduced-motion: reduce');

      const navRailCss = cssModules[2];
      expect(navRailCss).toContain('@media (max-width: 1023px)');
      expect(navRailCss).toContain('prefers-reduced-motion: reduce');

      const buttonCss = readFrontend('design-system/components/Button.module.css');
      expect(buttonCss).toContain(':where(.button)');

      const examLandingCss = readFrontend('app/(app)/mock-test/_shared/ExamLandingPage.module.css');
      expect(examLandingCss).toMatch(/\.mobileBackBtn\s*\{[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
    });
  });
});
