import { expect, test } from '@playwright/test';
import { loginFixtureUser, routeBackendApi } from './helpers/auth-fixture';

test.afterEach(async ({ context }) => { await context.unrouteAll({ behavior: 'wait' }); });

test('mobile Home hero integrates Recent Quizzes without quotes or carousel dots and fits 390px and 320px in both themes', async ({ page, context, request }, info) => {
  test.skip(info.project.name !== 'mobile', 'The integrated mobile hero belongs to mobile Home');
  const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
  await routeBackendApi(context, {
    token,
    accessSession: 'hero-carousel-fixture',
    frontendUrl: info.project.use.baseURL!,
  });
  await context.addInitScript(() => localStorage.setItem('ui-theme', 'light'));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const header = page.locator('header[data-ui-chrome="header"]').filter({ visible: true });
  await expect(header.getByRole('link', { name: 'Your profile', exact: true })).toHaveCount(0);
  const you = page.getByRole('navigation', { name: 'Primary', exact: true }).getByRole('link', { name: 'You', exact: true });
  await expect(you).toHaveAttribute('href', '/profile');
  await expect(you.locator('svg path')).toHaveCount(0);

  const hero = page.locator('section[aria-label="Study header"]');
  await expect(hero).toBeVisible();
  await expect(page.getByRole('region', { name: 'Daily study inspiration' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Small steps|Stay Consistent|Keep Moving Forward/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Show card/i })).toHaveCount(0);

  const recentHeading = hero.locator('#mobile-recent-title');
  await expect(recentHeading).toHaveText('Recent Quizzes');
  await expect(recentHeading).toBeVisible();
  const heroBox = (await hero.boundingBox())!;
  const recentBox = (await recentHeading.boundingBox())!;
  expect(recentBox.y).toBeGreaterThanOrEqual(heroBox.y);
  expect(recentBox.y + recentBox.height).toBeLessThanOrEqual(heroBox.y + heroBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('hero-integrated-light.png') });

  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    localStorage.setItem('ui-theme', 'dark');
    for (const el of [document.documentElement, document.body]) {
      el.classList.remove('theme-light');
      el.classList.add('dark', 'theme-dark');
      el.setAttribute('data-theme', 'dark');
    }
  });
  await expect(recentHeading).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('hero-integrated-dark-320.png') });

  await you.tap();
  await expect(page).toHaveURL(/\/profile$/);
  expect(errors).toEqual([]);
});

test('mobile Home keeps only 3 recent quizzes and resumes all 3 to their saved questions', async ({ page, context, request }, info) => {
  test.skip(info.project.name !== 'mobile', 'The integrated mobile hero belongs to mobile Home');
  const { token } = await loginFixtureUser(request, 'browser-mobile@example.test');
  await routeBackendApi(context, {
    token,
    accessSession: 'hero-recent-3-fixture',
    frontendUrl: info.project.use.baseURL!,
  });

  const makeQuestions = (topic: string, subject: string, prefix: string) =>
    Array.from({ length: 5 }, (_, index) => ({
      id: `${topic}-${index + 1}`,
      topic,
      subject,
      exam: 'SSC CGL',
      concept: 'Practice',
      difficulty: 'easy',
      question: `${prefix} Q${index + 1}`,
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctAnswer: 1,
      solution: 'Option B is correct.',
    }));

  const questionBank: Record<string, ReturnType<typeof makeQuestions>> = {
    algebra: makeQuestions('algebra', 'mathematics', 'Algebra'),
    analogy: makeQuestions('analogy', 'reasoning', 'Analogy'),
    'active-passive-voice': makeQuestions('active-passive-voice', 'english', 'Voice'),
  };

  const recentDetails: Record<string, {
    quizKey: string;
    title: string;
    subject: string;
    href: string;
    mode: string;
    currentIndex: number;
    totalQuestions: number;
    selectedAnswers: Record<number, number>;
    submittedQuestions: number[];
    results: Array<{ questionIndex: number; selected: number; correct: number; isCorrect: boolean }>;
    status: 'in-progress' | 'completed';
  }> = {
    'mathematics:algebra': {
      quizKey: 'mathematics:algebra',
      title: 'Algebra',
      subject: 'mathematics',
      href: '/mathematics/advance/algebra/quiz',
      mode: 'concept',
      currentIndex: 2,
      totalQuestions: 5,
      selectedAnswers: { 0: 1, 1: 0 },
      submittedQuestions: [0, 1],
      results: [
        { questionIndex: 0, selected: 1, correct: 1, isCorrect: true },
        { questionIndex: 1, selected: 0, correct: 1, isCorrect: false },
      ],
      status: 'in-progress',
    },
    'reasoning:analogy': {
      quizKey: 'reasoning:analogy',
      title: 'Analogy',
      subject: 'reasoning',
      href: '/reasoning/analogy/quiz',
      mode: 'concept',
      currentIndex: 1,
      totalQuestions: 5,
      selectedAnswers: { 0: 1 },
      submittedQuestions: [0],
      results: [{ questionIndex: 0, selected: 1, correct: 1, isCorrect: true }],
      status: 'in-progress',
    },
    'english:active-passive-voice': {
      quizKey: 'english:active-passive-voice',
      title: 'Active & Passive Voice',
      subject: 'english',
      href: '/english/active-passive-voice/quiz',
      mode: 'concept',
      currentIndex: 3,
      totalQuestions: 5,
      selectedAnswers: { 0: 1, 1: 1, 2: 1, 3: 1 },
      submittedQuestions: [0, 1, 2, 3],
      results: [
        { questionIndex: 0, selected: 1, correct: 1, isCorrect: true },
        { questionIndex: 1, selected: 1, correct: 1, isCorrect: true },
        { questionIndex: 2, selected: 1, correct: 1, isCorrect: true },
        { questionIndex: 3, selected: 1, correct: 1, isCorrect: true },
      ],
      status: 'completed',
    },
  };

  const fourthQuiz = {
    quizKey: 'general-awareness:biology',
    title: 'Biology',
    subject: 'general-awareness',
    href: '/general-awareness/biology/quiz',
    mode: 'concept',
    currentIndex: 0,
    totalQuestions: 5,
    submittedQuestions: [],
    status: 'in-progress' as const,
  };

  const recentSummaries = [
    ...Object.values(recentDetails).map(({ selectedAnswers: _s, results: _r, ...summary }) => summary),
    fourthQuiz,
  ];

  await context.route('**/backend-api/**', async route => {
    const url = new URL(route.request().url());
    const apiPath = url.pathname.replace(/^\/backend-api/, '');

    if (apiPath === '/users/me') {
      return route.fulfill({
        json: {
          id: 'browser-mobile',
          name: 'Browser Student',
          email: 'browser-mobile@example.test',
          role: 'student',
          progress: {},
          bookmarks: [],
          recentQuizzes: recentSummaries,
        },
      });
    }

    if (apiPath.startsWith('/users/me/recent-quizzes/')) {
      const quizKey = decodeURIComponent(apiPath.slice('/users/me/recent-quizzes/'.length));
      const detail = recentDetails[quizKey];
      if (detail) return route.fulfill({ json: { quiz: detail } });
    }

    if (apiPath === '/api/questions/meta') {
      return route.fulfill({
        json: { total: 5, exams: ['SSC CGL'], concepts: ['Practice'], letters: {}, conceptGroups: [], groupingStatus: 'empty' },
      });
    }

    if (apiPath === '/api/questions/session') {
      const topic = url.searchParams.get('topic') || 'algebra';
      const questions = questionBank[topic] ?? questionBank.algebra;
      return route.fulfill({ json: { questions, hasMore: false, nextCursor: null, totalCount: questions.length, startIndex: 0 } });
    }

    if (apiPath === '/users/me/recent-quizzes' && route.request().method() === 'PATCH') {
      return route.fulfill({ json: { saved: true } });
    }

    return route.fallback();
  });

  const expectedTargets = [
    { subtitle: 'Algebra', prompt: 'Algebra Q3', urlPart: '/mathematics/advance/algebra/quiz' },
    { subtitle: 'Analogy', prompt: 'Analogy Q2', urlPart: '/reasoning/analogy/quiz' },
    { subtitle: 'Active & Passive Voice', prompt: 'Voice Q4', urlPart: '/english/active-passive-voice/quiz' },
  ];

  for (let index = 0; index < expectedTargets.length; index++) {
    await page.goto('/');
    const hero = page.locator('section[aria-label="Study header"]');
    const cards = hero.locator('article');
    await expect(cards).toHaveCount(3);
    await expect(hero.getByText(/Biology/)).toHaveCount(0);

    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText(expectedTargets[index].subtitle);
    await card.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`${expectedTargets[index].urlPart}.*resume=1`));
    await expect(page.locator('.ios-series-prompt')).toContainText(expectedTargets[index].prompt, { timeout: 15000 });
  }
});
