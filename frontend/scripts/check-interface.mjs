import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Browser regression for the shared CSS cascade, independent of auth/API data.
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const css = (await Promise.all([
  'app/light-theme.css', 'app/dark-theme.css', 'app/interface.css',
].map(read))).join('\n');
const mobile = (await read('components/quiz-engine/views/mobile-quiz-view.styles.ts')).split('`')[1];
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  const page = await browser.newPage();
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.setContent(`<style>
        * { box-sizing: border-box; } body { margin: 0; }
        :root { --safe-top: 0px; --safe-bottom: 0px; --safe-left: 0px; --safe-right: 0px; }
        ${css} ${mobile}
        .controls { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px; }
        .legacy { width: 24px; height: 32px; padding: 6px; border-radius: 50%; }
        .legacy svg { width: 30px; height: 16px; }
        .legacy-switch { background: #308650; }
        .legacy-switch span { position: absolute; top: 2px; left: 2px; background: white; }
      </style><div data-theme="${theme}" class="ios-series-quiz">
        <div class="controls">
          <button aria-label="Close" class="legacy" data-ui-button="icon"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
          <button aria-label="Selected bookmark" class="legacy" data-ui-button="state" data-ui-shape="icon" style="background:rgb(10, 40, 70)"><svg viewBox="0 0 24 24" /></button>
          <button data-ui-button="secondary" style="width:120px">A long action label that needs to wrap</button>
          <button class="legacy-switch" data-ui-button="state" role="switch" aria-label="Theme" aria-checked="true"><span></span></button>
          <button data-ui-button="state" data-ui-shape="icon" style="display:none" aria-label="Hidden microphone"></button>
        </div>
        <div class="ios-series-options">
          <button class="ios-series-option" data-ui-button="state">Answer</button>
          <button class="ios-series-option is-correct" data-ui-button="state" disabled>Correct answer</button>
        </div>
        <button data-ui-button="primary">Submit</button>
      </div>`);
      const metrics = await page.evaluate(() => {
        const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const icons = [...document.querySelectorAll('.legacy')];
        const toggle = document.querySelector('[role="switch"]');
        const action = document.querySelector('[data-ui-button="secondary"]');
        const answer = document.querySelector('.ios-series-option');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          icons: icons.map(el => ({ ...rect(el), radius: getComputedStyle(el).borderRadius, glyph: rect(el.querySelector('svg')) })),
          stateColor: getComputedStyle(icons[1]).backgroundColor,
          toggle: rect(toggle), thumb: rect(toggle.firstElementChild),
          labelFits: action.scrollHeight <= action.clientHeight,
          hidden: getComputedStyle(document.querySelector('[aria-label="Hidden microphone"]')).display,
          answerHeight: rect(answer).height,
          correctOpacity: getComputedStyle(document.querySelector('.is-correct')).opacity,
          canvas: getComputedStyle(document.querySelector('.ios-series-quiz')).backgroundColor,
          submit: getComputedStyle(document.querySelector('[data-ui-button="primary"]')).backgroundColor,
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
      assert.ok(metrics.answerHeight >= 64);
      assert.equal(metrics.correctOpacity, '1');
      if (theme === 'dark') {
        assert.equal(metrics.canvas, 'rgb(0, 0, 0)');
        assert.equal(metrics.submit, 'rgb(53, 109, 168)');
      }
      console.log(`${theme} ${width}px: control geometry, state colors, wrapping, and quiz styles passed`);
    }
  }
} finally {
  await browser.close();
}
