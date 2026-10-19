import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const read = file => readFile(new URL(`../app/${file}`, import.meta.url), 'utf8');
const css = (await Promise.all(['light-theme.css', 'dark-theme.css', 'interface.css'].map(read))).join('\n');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<style>${css}
    .legacy { background: var(--light-only-surface, rgb(29 32 40)); color: var(--light-only-text, rgb(240 241 245)); border: 1px solid var(--light-only-border, rgb(70 74 83)); }
    .legacy small { color: var(--light-only-text-muted, rgb(170 175 184)); }
  </style><main class="legacy"><p>Question text</p><small>Secondary information</small><input placeholder="Search topics" /></main>
  <section data-theme="dark"><div class="legacy" id="nested-dark">Dark preview</div></section>`);

  const color = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
  const luminance = rgb => rgb.map(value => {
    const channel = value / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  }).reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => (Math.max(luminance(color(a)), luminance(color(b))) + .05) / (Math.min(luminance(color(a)), luminance(color(b))) + .05);
  for (const theme of ['dark', 'light', 'dark']) {
    await page.evaluate(theme => {
      for (const element of [document.documentElement, document.body]) element.className = `theme-${theme}`;
    }, theme);
    const actual = await page.evaluate(() => {
      const legacy = getComputedStyle(document.querySelector('main'));
      const root = getComputedStyle(document.documentElement);
      const nested = getComputedStyle(document.querySelector('#nested-dark'));
      const resolve = token => {
        const element = document.createElement('span');
        element.style.color = `var(${token})`;
        document.body.append(element);
        const result = getComputedStyle(element).color;
        element.remove();
        return result;
      };
      return {
        background: legacy.backgroundColor, text: legacy.color, border: legacy.borderTopColor,
        nested: { background: nested.backgroundColor, text: nested.color },
        alias: root.getPropertyValue('--light-only-surface').trim(),
        placeholder: getComputedStyle(document.querySelector('input'), '::placeholder').color,
        palette: Object.fromEntries(['canvas', 'surface', 'surface-muted', 'text', 'text-secondary', 'text-muted', 'success', 'success-soft', 'danger', 'danger-soft', 'warning', 'warning-soft'].map(name => [name, resolve(`--light-${name}`)])),
      };
    });
    assert.deepEqual(actual.nested, { background: 'rgb(29, 32, 40)', text: 'rgb(240, 241, 245)' }, 'Dark previews retain their original colors inside light pages');
    if (theme === 'dark') {
      assert.equal(actual.background, 'rgb(29, 32, 40)');
      assert.equal(actual.text, 'rgb(240, 241, 245)');
      assert.equal(actual.border, 'rgb(70, 74, 83)');
      assert.equal(actual.alias, '', 'Light-only aliases must not leak into dark mode');
      continue;
    }
    assert.equal(actual.background, 'rgb(255, 255, 255)');
    assert.equal(actual.text, actual.palette.text);
    assert.equal(actual.placeholder, actual.palette['text-muted']);
    for (const text of ['text', 'text-secondary', 'text-muted']) for (const surface of ['canvas', 'surface', 'surface-muted']) {
      assert(contrast(actual.palette[text], actual.palette[surface]) >= 4.5, `${text} must remain readable on ${surface}`);
    }
    for (const state of ['success', 'danger', 'warning']) assert(contrast(actual.palette[state], actual.palette[`${state}-soft`]) >= 4.5, `${state} feedback must remain readable`);
  }
  console.log('Shared light palette: readable text, semantic states, theme switching, and dark isolation passed');
} finally {
  await browser.close();
}
