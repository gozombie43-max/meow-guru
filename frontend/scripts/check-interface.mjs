import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Browser regression for the shared CSS cascade, independent of auth/API data.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const css = (await Promise.all([
  'app/light-theme.css', 'app/dark-theme.css', 'app/interface.css',
].map(read))).join('\n');
const mobile = await read('features/quiz/components/views/mobile-quiz-view.css');
const language = (await read('components/LangToggle.tsx')).split('<style>{`')[1].split('`}</style>')[0];
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  for (const width of [320, 390, 768, 1366, 1440]) {
    let lightGeometry;
    await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 844 : 900 });
    for (const theme of ['light', 'dark']) {
      await page.setContent(`<style>
        * { box-sizing: border-box; } body { margin: 0; }
        :root { --safe-top: 0px; --safe-bottom: 0px; --safe-left: 0px; --safe-right: 0px; }
        ${css} ${mobile} ${language}
        .lang-toggle { display: inline-flex; background: var(--lang-toggle-bg); }
        .lang-toggle > div { display: flex; position: relative; }
        .lang-toggle-option { border: 0; background: transparent; }
        .lang-toggle-slider { position: absolute; width: 55px; height: 100%; background: var(--lang-toggle-active-bg); }
        .controls { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; }
        .legacy { width: 24px; height: 32px; padding: 6px; border-radius: 50%; }
        .legacy svg { width: 30px; height: 16px; }
        .legacy-switch { background: #308650; }
        .legacy-switch span { position: absolute; top: 2px; left: 2px; background: white; }
      </style><div data-theme="${theme === 'light' ? 'dark' : 'light'}"><div data-theme="${theme}" class="ios-series-quiz">
        <header data-ui-chrome="header" class="ios-series-header"><div class="ios-series-header-left"><button class="ios-series-icon-button" data-ui-button="icon" aria-label="Back"></button></div>
          <div class="ios-series-header-center"><div class="lang-toggle"><div><div class="lang-toggle-slider"></div>${['English', 'हिंदी', 'বাংলা'].map(label => `<button data-ui-button="state" class="lang-toggle-option">${label}</button>`).join('')}</div></div></div>
          <div class="ios-series-header-right"><button class="ios-series-icon-button" data-ui-button="icon" aria-label="Settings"></button></div>
        </header>
        <nav class="ios-series-rail"><button data-ui-button="state" class="ios-series-question">1</button><button data-ui-button="state" class="ios-series-question is-current">2</button></nav>
        <div class="controls">
          <button aria-label="Close" class="legacy" data-ui-button="icon"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          <button aria-label="Selected bookmark" class="legacy" data-ui-button="state" data-ui-shape="icon" style="background:rgb(10, 40, 70)"><svg viewBox="0 0 24 24" /></button>
          <button data-ui-button="secondary" style="width:120px">A long action label that needs to wrap</button>
          <button class="legacy-switch" data-ui-button="state" role="switch" aria-label="Theme" aria-checked="true"><span></span></button>
          <button data-ui-button="state" data-ui-shape="icon" style="display:none" aria-label="Hidden microphone"></button>
        </div>
        <section class="ios-series-question-card"><div class="ios-series-prompt">What is the correct answer?</div></section>
        <div class="ios-series-options">
          <button class="ios-series-option" data-ui-button="state">Answer</button>
          <button class="ios-series-option is-correct" data-ui-button="state" disabled>Correct answer</button>
          <button class="ios-series-option is-wrong" data-ui-button="state" disabled><span class="ios-series-option-letter">C</span><span class="ios-series-option-value">EDEVIC</span><span class="ios-series-option-status"><span class="ios-series-your-answer">Your answer</span><svg class="ios-series-answer-icon" /></span></button>
        </div>
        <footer class="ios-series-footer"><button class="ios-series-footer-btn" data-ui-button="secondary">Previous</button><button class="ios-series-footer-btn" data-ui-button="primary">Submit</button></footer>
      </div></div>`);
      const metrics = await page.evaluate(() => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const icons = [...document.querySelectorAll('.legacy')];
        const toggle = document.querySelector('[role="switch"]');
        const action = document.querySelector('[data-ui-button="secondary"]');
        const answer = document.querySelector('.ios-series-option');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          targets: [...document.querySelectorAll('.ios-series-header button, .ios-series-rail button')].map(rect),
          icons: icons.map(el => ({ ...rect(el), radius: getComputedStyle(el).borderRadius, glyph: rect(el.querySelector('svg')) })),
          stateColor: getComputedStyle(icons[1]).backgroundColor,
          toggle: rect(toggle), thumb: rect(toggle.firstElementChild),
          labelFits: action.scrollHeight <= action.clientHeight,
          hidden: getComputedStyle(document.querySelector('[aria-label="Hidden microphone"]')).display,
          answerHeight: rect(answer).height,
          submittedHeight: rect(document.querySelector('.is-wrong')).height,
          footerHeights: [...document.querySelectorAll('footer button')].map(el => rect(el).height),
          languageHeight: rect(document.querySelector('.lang-toggle')).height,
          languageBackground: getComputedStyle(document.querySelector('.lang-toggle')).backgroundColor,
          languageActive: getComputedStyle(document.querySelector('.lang-toggle-slider')).backgroundColor,
          correctOpacity: getComputedStyle(document.querySelector('.is-correct')).opacity,
          canvas: getComputedStyle(document.querySelector('.ios-series-quiz')).backgroundColor,
          headerBackground: getComputedStyle(document.querySelector('header')).backgroundColor,
          headerIconColor: getComputedStyle(document.querySelector('header button')).color,
          submit: getComputedStyle(document.querySelector('[data-ui-button="primary"]')).backgroundColor,
          geometry: ['.ios-series-header', '.ios-series-icon-button', '.lang-toggle', '.ios-series-question', '.ios-series-question-card', '.ios-series-prompt', '.ios-series-option', '.ios-series-option-letter', '.ios-series-footer', '.ios-series-footer-btn'].map(selector => {
            const node = document.querySelector(selector);
            const style = getComputedStyle(node);
            return { selector, ...rect(node), radius: style.borderRadius, padding: style.padding, gap: style.gap, fontSize: style.fontSize, lineHeight: style.lineHeight };
          }),
          questionBackground: getComputedStyle(document.querySelector('.ios-series-question-card')).backgroundColor,
        };
      });
      assert.equal(metrics.overflow, false);
      for (const icon of metrics.icons) {
        assert.equal(icon.width, 44);
        assert.equal(icon.height, 44);
        assert.equal(icon.radius, '12px');
        assert.equal(icon.glyph.width, 20);
        assert.equal(icon.glyph.height, 20);
        assert.ok(Math.abs(icon.glyph.x + 10 - icon.x - 22) < 1);
        assert.ok(Math.abs(icon.glyph.y + 10 - icon.y - 22) < 1);
      }
      assert.equal(metrics.stateColor, 'rgb(10, 40, 70)');
      assert.equal(metrics.toggle.height, 44);
      assert.equal(metrics.thumb.height, 24);
      assert.ok(metrics.thumb.x + 24 <= metrics.toggle.x + metrics.toggle.width);
      assert.equal(metrics.labelFits, true);
      assert.equal(metrics.hidden, 'none');
      for (const target of metrics.targets) {
        assert.ok(target.width >= 44 && target.height >= 44, `undersized target: ${JSON.stringify(target)}`);
        assert.ok(target.x >= 0 && target.x + target.width <= width, 'target outside viewport');
      }
      assert.ok(metrics.answerHeight >= 52);
      assert.ok(metrics.submittedHeight >= 52, 'submitted answer keeps its readable minimum height');
      assert.deepEqual(metrics.footerHeights, [50, 50]);
      assert.equal(metrics.languageHeight, 44);
      assert.equal(metrics.correctOpacity, '1');
      assert.equal(metrics.questionBackground, 'rgba(0, 0, 0, 0)');
      if (theme === 'light') {
        lightGeometry = metrics.geometry;
        assert.equal(metrics.canvas, 'rgb(245, 247, 250)');
        assert.equal(metrics.headerBackground, 'rgb(255, 255, 255)', 'Light headers must not inherit the dark canvas');
        assert.equal(metrics.headerIconColor, 'rgb(24, 36, 56)', 'Light header icons must remain readable');
        assert.equal(metrics.submit, 'rgb(0, 122, 255)');
        assert.equal(metrics.languageBackground, 'rgb(237, 241, 246)');
      } else {
        assert.deepEqual(metrics.geometry, lightGeometry, 'Light and dark mobile quiz geometry must match');
      }
      if (theme === 'dark') {
        assert.equal(metrics.canvas, 'rgb(0, 0, 0)');
        assert.equal(metrics.headerBackground, 'rgb(0, 0, 0)', 'Dark headers retain the OLED canvas');
        assert.equal(metrics.headerIconColor, 'rgb(229, 234, 240)');
        assert.equal(metrics.submit, 'rgb(10, 132, 255)');
        assert.equal(metrics.languageBackground, 'rgb(28, 28, 30)');
        assert.equal(metrics.languageActive, 'rgba(10, 132, 255, 0.16)');
      }
      console.log(`${theme} ${width}px: control geometry, state colors, wrapping, and quiz styles passed`);
    }
  }
  for (const safeBottom of [0, 24, 34, 48]) {
    await page.setViewportSize({ width: 390, height: 640 });
    await page.setContent(`<style>
      * { box-sizing: border-box; } body { margin: 0; }
      :root { --safe-top: 44px; --safe-bottom: ${safeBottom}px; --safe-left: 0px; --safe-right: 0px; }
      ${css} ${mobile}
    </style><div class="ios-series-quiz" data-theme="dark">
      <div class="ios-series-palette"><div class="ios-series-palette-panel">
        <div class="ios-series-palette-title">Questions</div>
        <div class="ios-series-palette-grid">${Array.from({ length: 100 }, (_, index) => `<button data-ui-button="state">${index + 1}</button>`).join('')}
        <div class="ios-series-palette-load-more"><button data-ui-button="secondary">Load more questions</button></div>
        </div>
      </div></div></div>`);
    const palette = await page.evaluate(() => {
      const grid = document.querySelector('.ios-series-palette-grid');
      const loadMore = document.querySelector('.ios-series-palette-load-more button');
      const hiddenInitially = loadMore.getBoundingClientRect().top >= grid.getBoundingClientRect().bottom;
      grid.scrollTop = grid.scrollHeight;
      const button = loadMore.getBoundingClientRect();
      const panel = document.querySelector('.ios-series-palette-panel').getBoundingClientRect();
      return { clearance: innerHeight - button.bottom, buttonHeight: button.height,
        scrollable: grid.scrollHeight > grid.clientHeight, gridBottom: grid.getBoundingClientRect().bottom,
        buttonTop: button.top, buttonBottom: button.bottom, hiddenInitially, panelTop: panel.top };
    });
    assert.ok(palette.clearance >= safeBottom + 16, 'Load more clears the device navigation area');
    assert.ok(palette.buttonHeight >= 44);
    assert.ok(palette.scrollable);
    assert.ok(palette.hiddenInitially, 'Load more is below the initially visible questions');
    assert.ok(palette.buttonBottom <= palette.gridBottom, 'Load more is visible at the end of the list');
    assert.ok(palette.panelTop >= 60);
    console.log(`Palette ${safeBottom}px bottom safe area: Load more clearance and independent scrolling passed`);
  }
} finally {
  await browser.close();
}
