const { chromium, expect } = require('../../frontend/node_modules/@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const base = 'http://localhost:3000';
const resultPath = '/mock-test/ssc-chsl/paper/result/completed';
const keys = ['math', 'english', 'reasoning', 'gk', 'computer', 'statistics'];
const labels = ['Mathematics', 'English', 'Reasoning', 'General awareness', 'Computer knowledge', 'Statistics'];

function attempt(kind) {
  const size = kind === 'six-sections' ? 6 : kind === 'no-sections' ? 0 : 4;
  const sections = keys.slice(0, size).map((key, i) => ({ key, label: labels[i], total: 25,
    correct: kind === 'negative' ? 0 : kind === 'unattempted' ? 0 : kind === 'perfect' ? 25 : [18, 20, 14, 16, 21, 19][i],
    incorrect: kind === 'negative' ? (i === 0 ? 1 : 0) : kind === 'unattempted' || kind === 'perfect' ? 0 : [3, 2, 6, 4, 2, 3][i],
  })).map(s => ({ ...s, skipped: 25 - s.correct - s.incorrect, score: s.correct * 2 - s.incorrect * .5, maxScore: 50, accuracy: s.correct + s.incorrect ? s.correct / (s.correct + s.incorrect) * 100 : 0 }));
  const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
  const maxScore = sections.length * 50;
  const paper = { examName: 'SSC CHSL Tier I', schemaDriven: true, compositeTimer: true, totalDurationMin: 60, sections: sections.map(s => ({ key: s.key, label: s.label, questionCount: 25, marking: { correct: 2, incorrect: .5 }, questions: Array.from({ length: 25 }, (_, i) => ({ id: `${s.key}-${i}`, question: `${s.label} review question ${i + 1}`, options: ['First option', 'Second option', 'Third option', 'Fourth option'], solution: `${s.label} worked explanation`, topic: 'algebra' })) })) };
  const answers = Object.fromEntries(paper.sections.flatMap((s, n) => s.questions.slice(0, sections[n].correct + sections[n].incorrect).map((q, i) => [q.id, i < sections[n].correct ? 0 : 1])));
  return { id: 'completed', attemptId: 'completed', status: 'completed', assessmentMode: kind === 'confidential' ? 'confidential' : 'practice', answers, answerKey: Object.fromEntries(paper.sections.flatMap(s => s.questions.map(q => [q.id, 0]))), paper, result: { totalScore, maxScore, percentage: maxScore ? totalScore / maxScore * 100 : 0, percentile: kind === 'negative' ? 0 : 76.4, sections } };
}

(async () => {
  const browser = await chromium.launch();
  const checks = [];
  const cases = process.argv.includes('--quick') ? [[1366, 900, 'light', 'negative'], [390, 844, 'light', 'normal'], [390, 844, 'dark', 'normal']]
    : ['light', 'dark'].flatMap(theme => [[320, 740, theme, 'negative'], [390, 844, theme, 'normal'], [767, 900, theme, 'normal'], [768, 900, theme, 'normal'], [1024, 768, theme, 'normal'], [1366, 900, theme, 'negative'], [1917, 862, theme, 'normal'], [390, 844, theme, 'six-sections'], [390, 844, theme, 'confidential'], [390, 740, theme, 'unattempted'], [1366, 900, theme, 'perfect'], [320, 740, theme, 'no-sections']]);
  try {
    for (const [width, height, theme, kind] of cases) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      await context.addInitScript(theme => localStorage.setItem('ui-theme', theme), theme);
      await context.addCookies([{ name: 'access_session', value: 'local-ui-check', url: base }]);
      const data = attempt(kind); const requests = []; let startBody = null;
      const fresh = { ...data, id: 'fresh', attemptId: 'fresh', status: 'in_progress', result: undefined, answers: {}, questionStatuses: {}, timeLeft: 3600, revision: 0 };
      await context.route('**/backend-api/**', async route => {
        const url = new URL(route.request().url()); const apiPath = url.pathname.replace('/backend-api', '');
        requests.push(apiPath);
        let json = {};
        if (apiPath === '/auth/refresh') json = { token: 'local-ui-check' };
        if (apiPath === '/users/me') json = { id: 'visual-user', role: 'user', name: 'User' };
        if (apiPath.endsWith('/history')) json = { attempts: [] };
        if (apiPath.includes('/api/mocktest/attempt/')) json = apiPath.endsWith('/fresh') ? fresh : data;
        if (apiPath.endsWith('/autosave')) json = { revision: 1, saved: true };
        if (apiPath === '/api/mocktest/slots/paper') json = { slot: { id: 'paper', examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1', title: 'SSC CHSL 2025 Tier I · Shift 2', isFree: true, order: 1 } };
        if (apiPath.endsWith('/start')) {
          startBody = route.request().postDataJSON();
          json = fresh;
        }
        return route.fulfill({ json });
      });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}${resultPath}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('region', { name: 'Score summary' })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const dock = page.getByRole('region', { name: 'Result actions' });
      await expect(dock).toBeInViewport();
      if (kind === 'confidential') {
        await expect(page.getByRole('button', { name: 'Review answers', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Retake', exact: true })).toHaveCount(0);
        await expect(page.getByText('Confidential · Review and retakes unavailable.', { exact: true })).toBeVisible();
      } else await expect(page.getByRole('button', { name: 'Review answers', exact: true })).toBeInViewport();
      const file = `${width}-${height}-${theme}-${kind}`;
      await page.screenshot({ path: path.join(__dirname, `${file}.png`) });
      await page.screenshot({ path: path.join(__dirname, `${file}-full.png`), fullPage: true });
      if (kind === 'six-sections') {
        await page.getByRole('button', { name: 'Next sections' }).click();
        await expect(page.getByRole('heading', { name: 'Statistics', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Previous sections' }).click();
        await expect(page.getByRole('heading', { name: 'Mathematics', exact: true })).toBeVisible();
      }
      if (!['confidential', 'no-sections'].includes(kind)) {
        await page.getByRole('link', { name: 'Section results', exact: true }).click();
        await expect(page).toHaveURL(/#section-results$/);
        const last = page.getByRole('complementary', { name: 'Your next step' });
        await last.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const clearance = { bottom: await last.evaluate(el => el.getBoundingClientRect().bottom), dockTop: await dock.evaluate(el => el.getBoundingClientRect().top) };
        expect(clearance.bottom, `Bottom content clearance: ${file} ${JSON.stringify(clearance)}`).toBeLessThanOrEqual(clearance.dockTop);
      }
      if (kind === 'normal' && [390, 1366, 1917].includes(width)) {
        await page.getByRole('button', { name: 'Review English', exact: true }).click();
        await expect(page).toHaveURL(/\/review\/completed\?section=english$/);
        await expect(page.getByRole('combobox', { name: 'Section', exact: true })).toHaveValue('1');
        await expect(page.getByText('English review question 1', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Back to results', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${resultPath}(?:#section-results)?$`));
        await expect(page.getByRole('region', { name: 'Score summary' })).toBeAttached();
        await page.getByRole('button', { name: 'Retake', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Paper info' })).toBeVisible();
        expect(startBody).toBeNull();
        await page.getByRole('button', { name: 'Close paper info', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.getByRole('button', { name: 'Retake', exact: true }).click();
        await page.getByRole('button', { name: 'Restart test', exact: true }).click();
        await expect(page).toHaveURL(/\/attempt\?resume=fresh$/);
        expect(startBody).toEqual({ restart: true });
      }
      expect(errors).toEqual([]);
      checks.push({ width, height, theme, kind });
      await context.unrouteAll({ behavior: 'wait' }); await context.close();
    }
    fs.writeFileSync(path.join(__dirname, 'checks.json'), JSON.stringify(checks, null, 2));
    console.log(`${checks.length} result layout/navigation scenarios passed. Mocked API data; screenshots saved.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
