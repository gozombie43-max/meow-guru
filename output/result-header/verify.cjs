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
  const cases = ['light','dark'].flatMap(t=>[[320,740,t,'normal'],[390,844,t,'normal'],[1366,900,t,'normal']]);
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
        if (apiPath === '/api/mocktest/slots/paper') json = { slot: { id: 'paper', examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1', title: 'SSC CHSL 2025 S2', examDate: '2025-11-12', isFree: true, order: 1 } };
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

      const header=page.locator('header').filter({has:page.getByRole('heading',{name:'Test result',exact:true})});
      expect(await header.evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
      const before=await header.boundingBox();
      await page.evaluate(()=>window.scrollTo(0,500));
      const after=await header.boundingBox();
      expect(after.y).toBe(before.y);
      expect(after.y).toBe(0);
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      const last=page.getByRole('complementary',{name:'Your next step'});
      expect((await last.boundingBox()).y+(await last.boundingBox()).height).toBeLessThanOrEqual((await dock.boundingBox()).y);
      await context.close();
    }
    console.log('6 fixed-header checks passed');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
