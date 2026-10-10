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

/** Quiz grouping must also run in local quiz-only development. @param {NodeJS.ProcessEnv | Record<string, string>} env */
export function standaloneConceptGroupingEnabled(env = process.env) {
  return !embeddedWorkersEnabled(env) && (env.RUN_CONCEPT_GROUPING_WORKER === 'true'
    || (env.RUN_CONCEPT_GROUPING_WORKER !== 'false' && env.NODE_ENV === 'development'));
}
