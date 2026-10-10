import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { claimConceptGrouping, renewConceptGrouping, completeConceptGrouping, retryConceptGrouping, supersedeConceptGrouping, supersedeQueuedConceptGroupings } from '../repositories/conceptGroupRepository.js';
import { generateConceptGroups } from "../ai/conceptGrouping.js";
import { validateConceptGroups } from "./questions/conceptGroupService.js";
import { fetchQuestionsMeta } from './questions/questionMetadataService.js';
import { withTrace, withTraceCarrier } from '../infrastructure/tracing.js';
import { getReleaseId } from '../infrastructure/releaseInfo.js';

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
    // Upload batches enqueue successive snapshots. Only spend AI work on the
    // current bank contents, and ensure that their replacement is queued first.
    const current = await fetchQuestionsMeta(job.params);
    await supersedeQueuedConceptGroupings(job, current.groupingFingerprint || '');
    if (current.groupingFingerprint !== job._id) {
      await supersedeConceptGrouping(job);
      return { id: job._id, status: 'superseded', scope: job.scope };
    }
    const generated = await withTraceCarrier(job.trace, () => withTrace('job.concept-grouping', { 'job.attempt': job.attempts }, () => generate(job.scope, job.concepts)));
    const groups = validateConceptGroups(generated.output, job.concepts);
    if (!owned || !await completeConceptGrouping(job, { groups, model: generated.model, usage: generated.usage, version: job.version, releaseId: getReleaseId() })) throw new Error("Grouping lease expired");
    return { id: job._id, status: "completed", scope: job.scope, concepts: job.concepts.length, groups: groups.length };
  } catch (error) {
    const retry = job.attempts < 3;
    await retryConceptGrouping(job, retry, error);
    return { id: job._id, status: retry ? "retrying" : "failed", scope: job.scope, error: String(error.message).slice(0, 300) };
  } finally { clearInterval(heartbeat); }
}

let timer;
const running = new Set();
export function startConceptGroupingWorker() {
  if (timer) return;
  const tick = () => {
    while (running.size < 2) {
      const work = processConceptGroupingJob()
        .then(result => { if (result?.error) runtimeLog.error('Concept grouping job:', result.scope, result.error); })
        .catch(error => runtimeLog.error("Concept grouping worker:", error.message))
        .finally(() => { running.delete(work); });
      running.add(work);
    }
  };
  timer = setInterval(tick, 5000);
  timer.unref();
  tick();
}
export function stopConceptGroupingWorker() { clearInterval(timer); timer = null; }
export async function waitForConceptGroupingWorkerIdle(timeout = 12000) {
  if (!running.size) return true;
  let timeoutId;
  try { return await Promise.race([Promise.all([...running]).then(() => true), new Promise(resolve => { timeoutId = setTimeout(() => resolve(false), timeout); })]); }
  finally { clearTimeout(timeoutId); }
}
