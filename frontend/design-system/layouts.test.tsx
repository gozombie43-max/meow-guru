import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  AnalyticsTemplate,
  ConfigurationTemplate,
  DashboardTemplate,
  ListingTemplate,
  QuizTemplate,
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
  usePathname: () => '/play',
}));

const FRONTEND_ROOT = path.resolve(__dirname, '..');

describe('P0-E Page Layout Templates & Guidelines', () => {
  afterEach(() => {
    cleanup();
    mockBack.mockReset();
  });

  describe('DashboardTemplate', () => {
    it('renders tokens root, NavRail, BottomNav, skip link, hero, primary metrics, bento grid, and aside', () => {
      render(
        <DashboardTemplate
          pathname="/"
          headerProps={{ title: 'Home', actions: <button type="button">Theme</button> }}
          hero={<div>Daily Streak Hero</div>}
          primaryMetrics={
            <>
              <div>Accuracy 88%</div>
              <div>Questions 240</div>
            </>
          }
          aside={<div>Leaderboard Panel</div>}
          footer={<div>Study Tips</div>}
          gridColumns={3}
        >
          <section>Mathematics</section>
          <section>Reasoning</section>
          <section>English</section>
        </DashboardTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="dashboard"]');
      expect(root).toHaveAttribute('data-meow-tokens', '');
      expect(root).toHaveAttribute('data-meow-component', 'layout-template');
      expect(root).toHaveAttribute('data-meow-shell', 'standard');
      expect(root).toHaveAttribute('data-has-bottom-nav', 'true');

      expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
        'href',
        '#meow-main-content',
      );
      expect(screen.getByRole('banner')).toHaveAttribute('data-meow-component', 'app-header');
      expect(
        screen.getByRole('navigation', { name: 'Primary desktop navigation' }),
      ).toHaveAttribute('data-meow-component', 'nav-rail');
      expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute(
        'data-meow-component',
        'bottom-nav',
      );

      expect(screen.getByText('Daily Streak Hero')).toBeInTheDocument();
      expect(screen.getByText('Accuracy 88%')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
      expect(screen.getByText('Leaderboard Panel')).toBeInTheDocument();
      expect(screen.getByText('Study Tips')).toBeInTheDocument();
    });

    it('can suppress NavRail and BottomNav independently while keeping main landmark', () => {
      render(
        <DashboardTemplate showNavRail={false} showBottomNav={false}>
          <div>Compact Home</div>
        </DashboardTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="dashboard"]');
      expect(root).toHaveAttribute('data-has-bottom-nav', 'false');
      expect(document.querySelector('[data-meow-component="nav-rail"]')).toBeNull();
      expect(document.querySelector('[data-meow-component="bottom-nav"]')).toBeNull();
      expect(screen.getByRole('main')).toContainElement(screen.getByText('Compact Home'));
    });

    it('renders loading, retryable error, and empty states inside main landmark', () => {
      const onRetry = vi.fn();
      const { rerender } = render(
        <DashboardTemplate isLoading defaultLoadingLabel="Fetching stats...">
          <div>Hidden Content</div>
        </DashboardTemplate>,
      );

      expect(screen.getByRole('status')).toHaveTextContent('Fetching stats...');
      expect(screen.queryByText('Hidden Content')).toBeNull();

      rerender(
        <DashboardTemplate error="Network timeout" onRetry={onRetry} retryLabel="Reload dashboard">
          <div>Hidden Content</div>
        </DashboardTemplate>,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Network timeout');
      fireEvent.click(screen.getByRole('button', { name: 'Reload dashboard' }));
      expect(onRetry).toHaveBeenCalledTimes(1);

      rerender(
        <DashboardTemplate isEmpty defaultEmptyMessage="No sessions logged">
          <div>Hidden Content</div>
        </DashboardTemplate>,
      );

      expect(screen.getByRole('status')).toHaveTextContent('No sessions logged');
    });
  });

  describe('ListingTemplate', () => {
    it('keeps sticky filter controls mounted during loading, error, and empty states', () => {
      const { rerender } = render(
        <ListingTemplate
          headerProps={{ title: 'Mathematics', backHref: '/' }}
          intro={<p>Select a chapter to start practicing</p>}
          filters={<input type="search" aria-label="Search chapters" defaultValue="Algebra" />}
          toolbarActions={<span>12 chapters</span>}
          filterSidebar={<div>Difficulty Filter</div>}
          isLoading
        >
          <div>Algebra Card</div>
        </ListingTemplate>,
      );

      const searchInput = screen.getByRole('searchbox', { name: 'Search chapters' });
      expect(searchInput).toHaveValue('Algebra');
      expect(screen.getByText('Select a chapter to start practicing')).toBeInTheDocument();
      expect(screen.getByText('Difficulty Filter')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('data-meow-state', 'loading');
      expect(screen.queryByText('Algebra Card')).toBeNull();

      rerender(
        <ListingTemplate
          headerProps={{ title: 'Mathematics', backHref: '/' }}
          filters={<input type="search" aria-label="Search chapters" defaultValue="Algebra" />}
          isEmpty
        >
          <div>Algebra Card</div>
        </ListingTemplate>,
      );

      expect(screen.getByRole('searchbox', { name: 'Search chapters' })).toHaveValue('Algebra');
      expect(screen.getByRole('status')).toHaveAttribute('data-meow-state', 'empty');
    });

    it('renders results grid, pagination, and BackButton action inside AppHeader', () => {
      render(
        <ListingTemplate
          wide
          columns={2}
          headerProps={{ title: 'Mock Tests', backHref: '/' }}
          pagination={<button type="button">Load more</button>}
        >
          <div>Tier I</div>
          <div>Tier II</div>
        </ListingTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="listing"]');
      expect(root).toHaveAttribute('data-meow-tokens', '');
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
      expect(screen.getByText('Tier I')).toBeInTheDocument();
      expect(screen.getByText('Tier II')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    });
  });

  describe('QuizTemplate', () => {
    it('enforces fullscreen chrome without BottomNav or NavRail and renders topBar, reading pane, palette, and actionBar', () => {
      render(
        <QuizTemplate
          headerProps={{ title: 'SSC CGL Tier I', backHref: '/mock-test', variant: 'compact' }}
          subBar={<div>Progress: 12 / 25</div>}
          palette={<div>Question Palette Grid</div>}
          actionBar={
            <div>
              <button type="button">Previous</button>
              <button type="button">Next Question</button>
            </div>
          }
        >
          <article>Solve for x when 3x + 7 = 22.</article>
        </QuizTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="quiz"]');
      expect(root).toHaveAttribute('data-meow-tokens', '');
      expect(root).toHaveAttribute('data-meow-shell', 'fullscreen');
      expect(root).toHaveAttribute('data-locked-viewport', 'true');

      expect(document.querySelector('[data-meow-component="nav-rail"]')).toBeNull();
      expect(document.querySelector('[data-meow-component="bottom-nav"]')).toBeNull();

      expect(screen.getByText('Progress: 12 / 25')).toBeInTheDocument();
      expect(screen.getByText('Solve for x when 3x + 7 = 22.')).toBeInTheDocument();
      expect(screen.getByText('Question Palette Grid')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next Question' })).toBeInTheDocument();
    });
  });

  describe('ConfigurationTemplate', () => {
    it('supports desktop setup split with summary and sticky mobile actionBar', () => {
      render(
        <ConfigurationTemplate
          variant="setup"
          headerProps={{ title: 'Rapid Fire Setup', backHref: '/play' }}
          summary={<div>20 questions • 10 minutes</div>}
          actionBar={<button type="button">Start Session</button>}
        >
          <div>Question count selector</div>
        </ConfigurationTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="configuration"]');
      expect(root).toHaveAttribute('data-meow-tokens', '');
      expect(screen.getByText('Question count selector')).toBeInTheDocument();
      expect(screen.getByText('20 questions • 10 minutes')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Session' })).toBeInTheDocument();
    });

    it('supports centered auth variant and settings variant', () => {
      const { rerender } = render(
        <ConfigurationTemplate
          variant="auth"
          hero={<h1>Sign in to Meow</h1>}
          footer={<p>New here? Create account</p>}
        >
          <form aria-label="Sign in form">
            <input aria-label="Email" />
          </form>
        </ConfigurationTemplate>,
      );

      expect(screen.getByRole('heading', { name: 'Sign in to Meow' })).toBeInTheDocument();
      expect(screen.getByRole('form', { name: 'Sign in form' })).toBeInTheDocument();
      expect(screen.getByText('New here? Create account')).toBeInTheDocument();

      rerender(
        <ConfigurationTemplate variant="settings" headerProps={{ title: 'Settings', backHref: '/profile' }}>
          <section>Theme Preferences</section>
        </ConfigurationTemplate>,
      );

      expect(screen.getByText('Theme Preferences')).toBeInTheDocument();
    });
  });

  describe('AnalyticsTemplate', () => {
    it('renders score hero, responsive KPI grid, 2-col breakdown, review details, and footer actions without BottomNav', () => {
      render(
        <AnalyticsTemplate
          headerProps={{ title: 'Mock Result', backHref: '/mock-test' }}
          hero={<div>Score 164 / 200</div>}
          kpis={
            <>
              <div>Accuracy: 86%</div>
              <div>Correct: 82</div>
              <div>Wrong: 13</div>
              <div>Time: 48m</div>
            </>
          }
          breakdown={
            <>
              <div>Subject Breakdown Chart</div>
              <div>Time Allocation Chart</div>
            </>
          }
          actions={<button type="button">Review Answers</button>}
        >
          <div>Question 1 Review</div>
        </AnalyticsTemplate>,
      );

      const root = document.querySelector('[data-meow-layout="analytics"]');
      expect(root).toHaveAttribute('data-meow-tokens', '');
      expect(root).toHaveAttribute('data-has-bottom-nav', 'false');
      expect(document.querySelector('[data-meow-component="bottom-nav"]')).toBeNull();

      expect(screen.getByText('Score 164 / 200')).toBeInTheDocument();
      expect(screen.getByText('Accuracy: 86%')).toBeInTheDocument();
      expect(screen.getByText('Subject Breakdown Chart')).toBeInTheDocument();
      expect(screen.getByText('Question 1 Review')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Review Answers' })).toBeInTheDocument();
    });
  });

  describe('Static CSS Rules', () => {
    it('keeps Layouts.module.css compliant with dynamic viewports, motion, and 1024px breakpoint contracts', () => {
      const css = fs.readFileSync(
        path.join(FRONTEND_ROOT, 'design-system', 'layouts', 'Layouts.module.css'),
        'utf8',
      );

      expect(css).not.toContain('100vh');
      expect(css).not.toContain('min-h-screen');
      expect(css).not.toContain('1025px');
      expect(css).not.toMatch(/backdrop-filter:\s*blur/i);
      expect(css).not.toMatch(/transition:\s*all\b/i);
      expect(css).toContain('100dvh');
      expect(css).toContain('@media (min-width: 768px)');
      expect(css).toContain('@media (min-width: 1024px)');
    });
  });
});
