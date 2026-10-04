// @ts-check
/** Validate the deployable's role before starting any owned resources. */
/** @param {'api' | 'worker' | 'attachments'} expected @param {NodeJS.ProcessEnv | Record<string, string>} env */
export function assertProcessRole(expected, env = process.env) {
  const role = env.PROCESS_ROLE || expected;
  if (!['api', 'worker', 'attachments'].includes(role) || role !== expected) {
    throw new Error(`PROCESS_ROLE=${role} cannot run the ${expected} entry point`);
  }
  return role;
}

/** @param {NodeJS.ProcessEnv | Record<string, string>} env */
export function embeddedWorkersEnabled(env = process.env) {
  return env.QUIZ_ONLY_MODE !== 'true' && env.RUN_EMBEDDED_WORKERS === 'true';
}
