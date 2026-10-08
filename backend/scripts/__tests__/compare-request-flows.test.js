import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const exec = promisify(execFile);
it('joins request IDs and reports missing Mongo coverage rather than assuming zero work', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'flow-comparison-'));
  if (dirname(resolve(folder)) !== resolve(tmpdir()) || !basename(folder).startsWith('flow-comparison-')) throw new Error('Unexpected temporary test directory');
  const capture = id => ({ label: id, target: 'local', completed: true, project: 'desktop', samples: [{
    actions: [{ name: 'start_training', automationElapsedMs: 10 }],
    requests: [{ action: 'start_training', kind: 'api', durationMs: 6, serverRequestId: id }],
  }] });
  try {
    const after = join(folder, 'after.json'), before = join(folder, 'before.json'), logs = join(folder, 'logs.jsonl'), output = join(folder, 'report.json');
    await writeFile(after, JSON.stringify(capture('after'))); await writeFile(before, JSON.stringify(capture('before')));
    await writeFile(logs, JSON.stringify({ msg: 'request completed', requestId: 'after', mongo: { total: 2, operations: { 'authorization:users:find': 1, 'authorization:authSessions:find': 1 } } }) + '\n');
    await exec(process.execPath, ['scripts/compare-request-flows.js', after, logs, output, before, logs]);
    const report = JSON.parse(await readFile(output, 'utf8'));
    expect(report.after.actions[0]).toMatchObject({ matchedApiRequests: 1, matchedMongoCommands: 2, matchedAuthorizationCommands: 2 });
    expect(report.before.actions[0].unmatchedApiRequests).toBe(1);
    expect(report.comparison[0].mongoCommandsPerRunDelta).toBeNull();
    const line = await readFile(logs, 'utf8'); await writeFile(logs, line + line);
    await exec(process.execPath, ['scripts/compare-request-flows.js', after, logs, output]);
    expect(JSON.parse(await readFile(output, 'utf8')).after.duplicateLogRows).toBe(1);
    const retries = capture('after');
    retries.samples[0].requests.push({ ...retries.samples[0].requests[0] });
    await writeFile(after, JSON.stringify(retries));
    await writeFile(logs, line + JSON.stringify({ ...JSON.parse(line), time: 2 }) + '\n');
    await exec(process.execPath, ['scripts/compare-request-flows.js', after, logs, output]);
    expect(JSON.parse(await readFile(output, 'utf8')).after.actions[0]).toMatchObject({
      apiRequests: 2, matchedApiRequests: 2, matchedMongoCommands: 4, repeatedLogicalRequestIds: 1,
    });
  } finally {
    // Only this freshly created temp directory, never a computed workspace path.
    await rm(folder, { recursive: true, force: true });
  }
});
