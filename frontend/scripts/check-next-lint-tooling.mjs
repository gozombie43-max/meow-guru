import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('eslint-config-next'));
const { getRootDirs } = nextRequire('@next/eslint-plugin-next/dist/utils/get-root-dirs');
const pluginRequire = createRequire(nextRequire.resolve('@next/eslint-plugin-next'));
const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'meow-next-lint-glob-'));
const slash = (path) => path.replace(/\\/g, '/');
const roots = ['apps/web', 'apps/admin', 'apps/docs'];
for (const path of ['apps/web/app/known-page/nested', 'apps/admin/pages', 'apps/docs/src/app', 'apps/.hidden']) {
  mkdirSync(join(fixtureRoot, path), { recursive: true });
}
writeFileSync(join(fixtureRoot, 'apps/not-a-directory.txt'), 'not a Next app');
writeFileSync(join(fixtureRoot, 'apps/web/app/known-page/page.tsx'), 'export default function Page() { return null; }');
writeFileSync(join(fixtureRoot, 'apps/admin/pages/legacy.tsx'), 'export default function Page() { return null; }');
after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const discover = (rootDir) => getRootDirs({ cwd: frontendRoot, settings: { next: { rootDir } } });
const absoluteMatches = (matches) => matches.map((path) => slash(resolve(path))).sort();
const expected = (paths) => paths.map((path) => slash(join(fixtureRoot, path))).sort();

test('The configured Next plugin loads the safe directory matcher', () => {
  assert.equal(pluginRequire('fast-glob').globSync, require('@meow/next-lint-glob').globSync);
});

test('Next root discovery preserves its default and literal absolute roots', () => {
  assert.deepEqual(discover(undefined), [frontendRoot]);
  const literal = slash(join(fixtureRoot, 'apps/web'));
  assert.deepEqual(discover(literal), [literal]);
  assert.deepEqual(discover(literal.replace(/\//g, '\\')), [literal]);
});

test('Next root discovery handles relative, brace, globstar and array patterns', () => {
  const relativePattern = slash(relative(process.cwd(), join(fixtureRoot, 'apps/*')));
  assert.deepEqual(absoluteMatches(discover(relativePattern)), expected(roots));
  assert.ok(discover(relativePattern).every((path) => !path.endsWith('/')));
  assert.deepEqual(absoluteMatches(discover(slash(join(fixtureRoot, 'apps/{web,admin}')))), expected(['apps/web', 'apps/admin']));
  assert.deepEqual(absoluteMatches(discover(slash(join(fixtureRoot, 'apps/**/app')))), expected(['apps/web/app', 'apps/docs/src/app']));
  assert.deepEqual(absoluteMatches(discover([
    slash(join(fixtureRoot, 'apps/web')),
    slash(join(fixtureRoot, 'apps/docs')),
  ])), expected(['apps/web', 'apps/docs']));
});

test('Next root discovery excludes files, hidden directories and missing matches', () => {
  assert.deepEqual(absoluteMatches(discover(slash(join(fixtureRoot, 'apps/*')))), expected(roots));
  assert.deepEqual(discover(slash(join(fixtureRoot, 'apps/missing*'))), []);
});

test('Next internal-link rule remains active with globbed Pages roots', async () => {
  const eslint = new ESLint({
    cwd: frontendRoot,
    overrideConfig: { settings: { next: { rootDir: slash(join(fixtureRoot, 'apps/*')) } } },
  });
  const [result] = await eslint.lintText(
    'export default function Example() { return <a href="/legacy">Pages</a>; }',
    { filePath: join(frontendRoot, 'app/lint-glob-fixture.tsx') },
  );
  const linkErrors = result.messages.filter((message) => message.ruleId === '@next/next/no-html-link-for-pages');
  assert.equal(linkErrors.length, 1, JSON.stringify(result.messages));
  assert.ok(linkErrors.every((message) => message.severity === 2));
});

test('Next App Router client-component rules remain active', async () => {
  const eslint = new ESLint({ cwd: frontendRoot });
  const [result] = await eslint.lintText(
    '"use client"; export default async function Example() { return <div />; }',
    { filePath: join(frontendRoot, 'app/lint-glob-fixture.tsx') },
  );
  assert.ok(result.messages.some((message) => message.ruleId === '@next/next/no-async-client-component'));
});

test('Next Link navigation passes the same configured lint rules', async () => {
  const eslint = new ESLint({
    cwd: frontendRoot,
    overrideConfig: { settings: { next: { rootDir: slash(join(fixtureRoot, 'apps/*')) } } },
  });
  const [result] = await eslint.lintText(
    'import Link from "next/link"; export default function Example() { return <Link href="/known-page">Open</Link>; }',
    { filePath: join(frontendRoot, 'app/lint-glob-fixture.tsx') },
  );
  assert.deepEqual(result.messages, []);
});
