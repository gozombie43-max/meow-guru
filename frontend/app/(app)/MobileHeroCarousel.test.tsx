import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileHeroCarousel from './MobileHeroCarousel.client';
import MobileRecentQuiz from './MobileRecentQuiz.client';
import GuestWelcomeScreen from './GuestWelcomeScreen';

const authState = vi.hoisted(() => ({
  recentQuizzes: [] as Array<{
    quizKey: string;
    title: string;
    subject: string;
    href: string;
    mode?: string;
    currentIndex?: number;
    totalQuestions?: number;
    submittedQuestions?: number[];
    status?: 'in-progress' | 'completed';
  }>,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Charan', recentQuizzes: authState.recentQuizzes }, loading: false }),
}));
vi.mock('@/context/ExamModeContext', () => ({
  useExamMode: () => ({ isJam: false }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useThemeMode: () => ({ theme: 'light', setThemeMode: vi.fn(), toggleThemeMode: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

beforeEach(() => {
  authState.recentQuizzes = [];
});

afterEach(() => {
  cleanup();
});

describe('mobile hero banner', () => {
  it('renders the hero content without motivational quotes or carousel dot buttons', () => {
    render(
      <MobileHeroCarousel>
        <section aria-label="Study header">
          <h2>Recent Quizzes</h2>
        </section>
      </MobileHeroCarousel>,
    );

    expect(screen.getByRole('heading', { name: 'Recent Quizzes' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Daily study inspiration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Small steps|Stay Consistent|Keep Moving Forward/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Show card/i })).not.toBeInTheDocument();
  });

  it('caps MobileRecentQuiz at 3 quizzes and normalizes resume links', () => {
    authState.recentQuizzes = [
      { quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/mathematics/advance/algebra', mode: 'concept', totalQuestions: 20, submittedQuestions: [0, 1] },
      { quizKey: 'reasoning:analogy', title: 'Analogy', subject: 'reasoning', href: '/reasoning/analogy/quiz', mode: 'concept', totalQuestions: 15, submittedQuestions: [0] },
      { quizKey: 'english:voice', title: 'Voice', subject: 'english', href: '/english/active-passive-voice/quiz', mode: 'mixed', totalQuestions: 10, submittedQuestions: [0, 1, 2], status: 'completed' },
      { quizKey: 'general-awareness:biology', title: 'Biology', subject: 'general-awareness', href: '/general-awareness/biology/quiz', totalQuestions: 30, submittedQuestions: [] },
      { quizKey: 'mathematics:geometry', title: 'Geometry', subject: 'mathematics', href: '/mathematics/geometry/quiz', totalQuestions: 25, submittedQuestions: [] },
    ];

    render(<MobileRecentQuiz />);

    expect(screen.getByText(/Welcome back/i)).toHaveTextContent('Welcome back, Charan');
    expect(screen.getByText('Charan')).toBeInTheDocument();

    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(screen.queryByText(/Biology/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Geometry/)).not.toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/mathematics/advance/algebra/quiz?mode=concept&resume=1');
    expect(links[1]).toHaveAttribute('href', '/reasoning/analogy/quiz?mode=concept&resume=1');
    expect(links[2]).toHaveAttribute('href', '/english/active-passive-voice/quiz?mode=mixed&resume=1');
  });

  it('uses distinct light and dark webp hero images on mobile Home', () => {
    const staticContent = readFileSync(path.resolve(__dirname, 'HomeStaticContent.tsx'), 'utf8');
    const pageCss = readFileSync(path.resolve(__dirname, 'page.module.css'), 'utf8');
    const lightWebp = '/images/home-carousel/study-hero-light.webp';
    const darkWebp = '/images/home-carousel/study-hero-dark-v2.webp';

    expect(staticContent).toContain(lightWebp);
    expect(staticContent).toContain(darkWebp);
    expect(staticContent).not.toContain('study-overlay.webp');
    expect(staticContent).toContain('<small>15000+ Questions</small>');
    expect(pageCss).toContain(':is(.mobileSubjectCard, .resourceCard, .battleCard) strong');
    expect(pageCss).toContain(':is(.mobileSubjectCard, .resourceCard, .battleCard) small');
    expect(existsSync(path.resolve(__dirname, '../../public/images/home-carousel/study-hero-light.webp'))).toBe(true);
    expect(existsSync(path.resolve(__dirname, '../../public/images/home-carousel/study-hero-dark-v2.webp'))).toBe(true);
    expect(existsSync(path.resolve(__dirname, '../../public/images/home-carousel/study-hero-dark.webp'))).toBe(false);
    expect(existsSync(path.resolve(__dirname, '../../public/images/home-carousel/study-overlay.webp'))).toBe(false);
  });

  it('glides forward smoothly across the Recent Quizzes carousel without reverse sliding', () => {
    vi.useFakeTimers();
    try {
      authState.recentQuizzes = [
        { quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/mathematics/algebra/quiz', totalQuestions: 10, submittedQuestions: [0] },
        { quizKey: 'reasoning:analogy', title: 'Analogy', subject: 'reasoning', href: '/reasoning/analogy/quiz', totalQuestions: 10, submittedQuestions: [0] },
        { quizKey: 'english:voice', title: 'Voice', subject: 'english', href: '/english/voice/quiz', totalQuestions: 10, submittedQuestions: [0] },
      ];

      render(<MobileRecentQuiz />);

      expect(screen.getAllByRole('article')).toHaveLength(3);
      expect(screen.getAllByRole('link')).toHaveLength(3);

      const region = screen.getByRole('region', { name: 'Recent quizzes' });
      Object.defineProperty(region, 'clientWidth', { configurable: true, value: 360 });
      region.scrollLeft = 0;

      // Slide 0 -> 1 (0 -> 360)
      vi.advanceTimersByTime(4500);
      vi.advanceTimersByTime(425);
      expect(region.scrollLeft).toBeGreaterThan(0);
      expect(region.scrollLeft).toBeLessThan(360);
      vi.advanceTimersByTime(525);
      expect(region.scrollLeft).toBe(360);

      // Slide 1 -> 2 (360 -> 720)
      vi.advanceTimersByTime(3550);
      vi.advanceTimersByTime(950);
      expect(region.scrollLeft).toBe(720);

      // Slide 2 -> trailing clone (720 -> 1080 forward), then seamless reset to 0
      vi.advanceTimersByTime(3550);
      vi.advanceTimersByTime(425);
      expect(region.scrollLeft).toBeGreaterThan(720);
      expect(region.scrollLeft).toBeLessThan(1080);
      vi.advanceTimersByTime(525);
      expect(region.scrollLeft).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders the uploaded cat Meow logo instead of Study Guru', () => {
    const homeClient = readFileSync(path.resolve(__dirname, 'HomeClient.tsx'), 'utf8');

    expect(homeClient).toContain('aria-label="Meow home"');
    expect(homeClient).toContain('/images/meow-logo.webp');
    expect(homeClient).not.toContain('Study Guru');
    expect(existsSync(path.resolve(__dirname, '../../public/images/meow-logo.webp'))).toBe(true);
  });

  it('renders the Meow starting page for non-logged-in users with Get Started and sign-in actions', () => {
    const homeClient = readFileSync(path.resolve(__dirname, 'HomeClient.tsx'), 'utf8');
    const authGate = readFileSync(path.resolve(__dirname, '../../components/auth/AuthGate.tsx'), 'utf8');
    const guestWelcome = readFileSync(path.resolve(__dirname, 'GuestWelcomeScreen.tsx'), 'utf8');

    expect(homeClient).toContain('<GuestWelcomeScreen />');
    expect(authGate).toContain("'/login'");
    expect(authGate).toContain("'/register'");
    expect(guestWelcome).toContain('/images/meow-logo.webp');
    expect(guestWelcome).toContain('/images/welcome-cat-book-light.webp');
    expect(guestWelcome).toContain("setThemeMode('light')");
    expect(existsSync(path.resolve(__dirname, '../../public/images/welcome-cat-book-light.webp'))).toBe(true);

    render(<GuestWelcomeScreen />);

    expect(screen.queryByRole('button', { name: /Switch to (?:light|dark) theme/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Meow' })).toBeInTheDocument();
    expect(screen.getByText('Study Smarter. Go Further.')).toBeInTheDocument();
    expect(screen.getByText('SSC • RRB • Banking • CAT')).toBeInTheDocument();
    expect(screen.getByAltText('Cute cat reading a book — Small Steps Big Results')).toBeInTheDocument();
    expect(screen.getByText('Practice')).toBeInTheDocument();
    expect(screen.getByText('Track')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get Started/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'I already have an account' })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/A better you is a few questions away\./)).toBeInTheDocument();
    expect(document.body).toHaveClass('guest-welcome-route');
  });
});
