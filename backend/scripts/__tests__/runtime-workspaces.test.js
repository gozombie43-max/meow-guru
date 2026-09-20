import { afterEach, describe, expect, it } from 'vitest';
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures = [];
afterEach(() => {
  for (const directory of fixtures.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'meow-runtime-workspaces-'));
  fixtures.push(root);
  mkdirSync(join(root, 'backend/scripts'), { recursive: true });
  mkdirSync(join(root, 'contracts'));
  mkdirSync(join(root, 'node_modules/@meow'), { recursive: true });
  writeFileSync(join(root, 'backend/package.json'), JSON.stringify({ type: 'module', dependencies: { '@meow/contracts': '1.0.0' } }));
  writeFileSync(join(root, 'contracts/package.json'), JSON.stringify({ name: '@meow/contracts', type: 'module', exports: { './diagramPrompt': './diagramPrompt.js' } }));
  writeFileSync(join(root, 'contracts/diagramPrompt.js'), 'export const SYSTEM_PROMPT = "fixture prompt";');
  for (const name of ['materialize-runtime-workspaces.js', 'verify-runtime-dependencies.js']) {
    cpSync(new URL(`../${name}`, import.meta.url), join(root, 'backend/scripts', name));
  }
  symlinkSync(join(root, 'contracts'), join(root, 'node_modules/@meow/contracts'), process.platform === 'win32' ? 'junction' : 'dir');
  return root;
}

const run = (root, script, ...args) => spawnSync(process.execPath, [join(root, 'backend/scripts', script), ...args], { cwd: root, encoding: 'utf8' });

describe('Azure runtime workspace packaging', () => {
  it('rejects a deployable artifact that only resolves through a workspace link', () => {
    const root = fixture();
    expect(run(root, 'verify-runtime-dependencies.js').status).toBe(0);
    const checked = run(root, 'verify-runtime-dependencies.js', '--deployment');
    expect(checked.status).toBe(1);
    expect(checked.stderr).toContain('not a workspace symlink');
  });

  it('copies contracts without changing source and resolves after release relocation', () => {
    const root = fixture();
    const source = readFileSync(join(root, 'contracts/diagramPrompt.js'), 'utf8');
    expect(run(root, 'materialize-runtime-workspaces.js').status).toBe(0);
    expect(run(root, 'materialize-runtime-workspaces.js').status).toBe(0);
    const target = join(root, 'node_modules/@meow/contracts');
    expect(lstatSync(target).isSymbolicLink()).toBe(false);
    expect(realpathSync(target)).not.toBe(realpathSync(join(root, 'contracts')));
    expect(readFileSync(join(root, 'contracts/diagramPrompt.js'), 'utf8')).toBe(source);

    const release = mkdtempSync(join(tmpdir(), 'meow-runtime-release-'));
    fixtures.push(release);
    cpSync(root, release, { recursive: true });
    expect(run(release, 'verify-runtime-dependencies.js', '--deployment').status).toBe(0);
    writeFileSync(join(release, 'backend/probe.js'), 'import { SYSTEM_PROMPT } from "@meow/contracts/diagramPrompt"; console.log(SYSTEM_PROMPT);');
    const probe = spawnSync(process.execPath, [join(release, 'backend/probe.js')], { encoding: 'utf8' });
    expect(probe.status).toBe(0);
    expect(probe.stdout.trim()).toBe('fixture prompt');
  });
});
