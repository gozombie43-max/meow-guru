import { getMongoDB } from "../config/mongodb.js";
import { claimJob, renewJob, completeJob } from "../infrastructure/durableQueue.js";
import { generateConceptGroups } from "../ai/conceptGrouping.js";
import { GROUPING_COLLECTION, validateConceptGroups } from "./questions/conceptGroupService.js";

const LEASE_MS = 240000;
export async function processConceptGroupingJob(generate = generateConceptGroups) {
  const collection = getMongoDB().collection(GROUPING_COLLECTION);
  const job = await claimJob(collection, "concept-grouping", new Date(), LEASE_MS);
  if (!job) return null;
  let owned = true;
  const heartbeat = setInterval(() => {
    void renewJob(collection, job, new Date(), LEASE_MS).then(value => { owned = value; }).catch(() => { owned = false; });
  }, 30000);
  heartbeat.unref();
  try {
    const generated = await generate(job.scope, job.concepts);
    const groups = validateConceptGroups(generated.output, job.concepts);
    if (!owned || !await completeJob(collection, job, { groups, model: generated.model, usage: generated.usage, version: job.version })) throw new Error("Grouping lease expired");
    return { id: job._id, status: "completed", scope: job.scope, concepts: job.concepts.length, groups: groups.length };
  } catch (error) {
    const retry = job.attempts < 3;
    await collection.updateOne({ _id: job._id, owner: job.owner, status: "running", leaseUntil: { $gt: new Date() } }, {
      $set: { status: retry ? "queued" : "failed", error: String(error.message).slice(0, 300), availableAt: new Date(Date.now() + job.attempts * 15000) },
      $unset: { owner: "", leaseUntil: "" },
    });
    return { id: job._id, status: retry ? "retrying" : "failed", scope: job.scope, error: String(error.message).slice(0, 300) };
  } finally { clearInterval(heartbeat); }
}

let timer, running;
export function startConceptGroupingWorker() {
  if (timer) return;
  const tick = () => {
    if (!running) running = processConceptGroupingJob().catch(error => console.error("Concept grouping worker:", error.message)).finally(() => { running = null; });
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
