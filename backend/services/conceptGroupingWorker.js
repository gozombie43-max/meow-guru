import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { claimConceptGrouping, renewConceptGrouping, completeConceptGrouping, retryConceptGrouping } from '../repositories/conceptGroupRepository.js';
import { generateConceptGroups } from "../ai/conceptGrouping.js";
import { validateConceptGroups } from "./questions/conceptGroupService.js";
import { withTrace, withTraceCarrier } from '../infrastructure/tracing.js';

const LEASE_MS = 240000;
export async function processConceptGroupingJob(generate = generateConceptGroups) {
  const job = await claimConceptGrouping(LEASE_MS);
  if (!job) return null;
  let owned = true;
  const heartbeat = setInterval(() => {
    void renewConceptGrouping(job, LEASE_MS).then(value => { owned = value; }).catch(() => { owned = false; });
  }, 30000);
  heartbeat.unref();
  try {
    const generated = await withTraceCarrier(job.trace, () => withTrace('job.concept-grouping', { 'job.attempt': job.attempts }, () => generate(job.scope, job.concepts)));
    const groups = validateConceptGroups(generated.output, job.concepts);
    if (!owned || !await completeConceptGrouping(job, { groups, model: generated.model, usage: generated.usage, version: job.version })) throw new Error("Grouping lease expired");
    return { id: job._id, status: "completed", scope: job.scope, concepts: job.concepts.length, groups: groups.length };
  } catch (error) {
    const retry = job.attempts < 3;
    await retryConceptGrouping(job, retry, error);
    return { id: job._id, status: retry ? "retrying" : "failed", scope: job.scope, error: String(error.message).slice(0, 300) };
  } finally { clearInterval(heartbeat); }
}

let timer, running;
export function startConceptGroupingWorker() {
  if (timer) return;
  const tick = () => {
    if (!running) running = processConceptGroupingJob().catch(error => runtimeLog.error("Concept grouping worker:", error.message)).finally(() => { running = null; });
  };
  timer = setInterval(tick, 5000);
  timer.unref();
  tick();
}
export function stopConceptGroupingWorker() { clearInterval(timer); timer = null; }
export async function waitForConceptGroupingWorkerIdle(timeout = 12000) {
  if (!running) return true;
  let timeoutId;
  try { return await Promise.race([running.then(() => true), new Promise(resolve => { timeoutId = setTimeout(() => resolve(false), timeout); })]); }
  finally { clearTimeout(timeoutId); }
}
