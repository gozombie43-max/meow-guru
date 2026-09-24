import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

// Scoped source guardrails complement computed geometry in check-interface.
// Small glyphs, decorative badges and state colors are deliberately not banned.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const paths = ['app/(app)/play/play-hub.css', 'app/(app)/play/setup/[mode]/setup.css', 'components/SubjectHub.module.css'];
const failures = [];
for (const path of paths) {
  const css = postcss.parse(await read(path), { from: path });
  css.walkRules(rule => {
    rule.walkDecls(decl => {
      if (/\[data-ui-button=["'](?:primary|secondary|danger|icon)["']\]/.test(rule.selector) && /^(?:font-size|border-radius|min-height|height|padding)$/.test(decl.prop) && decl.important) failures.push(`${path}:${decl.source.start.line}: feature overrides shared control anatomy`);
      if (/^(?:height|min-height|max-height)$/.test(decl.prop) && /\b100vh\b/.test(decl.value)) failures.push(`${path}:${decl.source.start.line}: use dynamic viewport units`);
      if (/(?:nav-label|training-filters.*button|training-exam.*select)/.test(rule.selector) && decl.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(decl.value) && parseFloat(decl.value) < 12) failures.push(`${path}:${decl.source.start.line}: functional label below 12px`);
    });
  });
}
const globals = postcss.parse(await read('app/globals.css'));
globals.walkRules(rule => {
  if (!/(?:^|,)\s*(?:html|body)\s*(?:,|$)/.test(rule.selector)) return;
  rule.walkDecls(/user-select|touch-callout/, decl => { if (decl.value === 'none') failures.push('Document-wide selection suppression'); });
});
const setup = await read('app/(app)/play/setup/[mode]/page.tsx');
assert.ok(!setup.includes('play-setup-mode-title'), 'ambiguous setup title returned');
assert.ok(!/>\s*[✕×]\s*</u.test(setup), 'use a labeled close icon');
assert.deepEqual(failures, []);
console.log('Scoped UI source contract passed');
