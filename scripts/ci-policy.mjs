import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const backendPath = /^(?:backend\/|contracts\/|package(?:-lock)?\.json$|\.github\/workflows\/(?:ci-verify|main_quizguru-backend)\.yml$|scripts\/ci-)/;

export function verificationPolicy({ eventName, ref, verificationOnly = false, deployBackend = false, changedFiles = null }) {
  if (deployBackend && (eventName !== 'workflow_dispatch' || ref !== 'refs/heads/main' || verificationOnly)) {
    throw new Error('Manual production deployment requires a standalone workflow dispatch on main.');
  }
  const productionBranch = ref === 'refs/heads/main';
  const full = verificationOnly || deployBackend
    || ['pull_request', 'schedule', 'workflow_dispatch'].includes(eventName)
    || (eventName === 'push' && ['refs/heads/main', 'refs/heads/master'].includes(ref));
  const backendChanged = changedFiles === null || changedFiles.some(file => backendPath.test(file));
  return {
    full_validation: full,
    lighthouse: full,
    deploy_backend: !verificationOnly && productionBranch
      && ((eventName === 'push' && backendChanged) || (eventName === 'workflow_dispatch' && deployBackend)),
  };
}

export function changedPushFiles(event, sha, cwd = process.cwd()) {
  if (!/^[0-9a-f]{40}$/.test(event.before ?? '') || /^0+$/.test(event.before)) return null;
  try {
    return execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', event.before, sha], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    }).split('\0').filter(Boolean);
  } catch {
    // Unknown bases and force pushes must never silently suppress a deployment.
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const policy = verificationPolicy({
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    verificationOnly: process.env.VERIFICATION_ONLY === 'true',
    deployBackend: process.env.DEPLOY_BACKEND === 'true',
    changedFiles: process.env.GITHUB_EVENT_NAME === 'push' ? changedPushFiles(event, process.env.GITHUB_SHA) : [],
  });
  const output = Object.entries(policy).map(([key, value]) => `${key}=${value}`).join('\n');
  appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
  console.log(output);
}
