import { createHash } from "node:crypto";
import { traceCarrier } from '../../infrastructure/tracing.js';
import { enqueueConceptGrouping, readConceptGrouping } from '../../repositories/conceptGroupRepository.js';
import { normalizeSearchKey } from "./questionNormalizer.js";

export const GROUPING_VERSION = 1;
export const GROUPING_COLLECTION = "conceptGroupMetadata";
export const canonicalMode = mode => mode === "ai-challenge" ? "aiChallenge" : mode || "all";
export function groupingInput(params, concepts) {
  const scope = { subject: normalizeSearchKey(params.subject), topic: normalizeSearchKey(params.topic), mode: canonicalMode(params.mode) };
  const values = [...new Set(concepts.filter(c => typeof c === "string" && c.trim()).map(c => c.toLowerCase()))].sort();
  const fingerprint = createHash("sha256").update(JSON.stringify({ version: GROUPING_VERSION, scope, concepts: values })).digest("hex");
  return { scope, concepts: values, fingerprint };
}

export function validateConceptGroups(output, concepts) {
  const maxGroups = Math.min(200, Math.max(60, Math.ceil(concepts.length / 5)));
  if (!Array.isArray(output?.groups) || !output.groups.length || output.groups.length > maxGroups) throw new Error("Invalid group count");
  const seen = new Set(), labels = new Set();
  const groups = output.groups.map(group => {
    const label = typeof group.label === "string" ? group.label.trim() : "";
    const description = typeof group.description === "string" ? group.description.trim() : "";
    if (!label || label.length > 100 || /^(general|other|others|miscellaneous|misc|uncategorized)$/i.test(label) || labels.has(label.toLowerCase())) throw new Error("Invalid or duplicate group name");
    if (!description || description.length > 600 || !Array.isArray(group.conceptIds) || !group.conceptIds.length) throw new Error("Invalid group description or members");
    labels.add(label.toLowerCase());
    const members = group.conceptIds.map(id => {
      if (!Number.isInteger(id) || id < 0 || id >= concepts.length || seen.has(id)) throw new Error("Duplicate or invented concept ID");
      seen.add(id);
      return concepts[id];
    });
    return { id: createHash("sha256").update(label.toLowerCase()).digest("hex").slice(0, 16), label, description, concepts: members };
  });
  if (seen.size !== concepts.length) throw new Error("AI omitted concepts");
  return groups;
}

export async function ensureConceptGroups(params, concepts) {
  const input = groupingInput(params, concepts);
  if (!input.concepts.length) return { conceptGroups: [], groupingStatus: "empty" };
  const now = new Date();
  const doc = await enqueueConceptGrouping(input.fingerprint, {
    ...input, params, version: GROUPING_VERSION, kind: "concept-grouping", trace: traceCarrier(), status: "queued", attempts: 0,
    availableAt: now, createdAt: now, expiresAt: new Date(+now + 10 * 365 * 86400000),
  });
  return {
    conceptGroups: doc.status === "completed" ? doc.result.groups : [],
    groupingStatus: doc.status === "completed" ? "ready" : doc.status === "failed" ? "failed" : "processing",
    groupingFingerprint: input.fingerprint,
  };
}

export async function fetchConceptGroupingStatus(fingerprint) {
  if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw Object.assign(new Error('Invalid grouping fingerprint'), { statusCode: 400 });
  }
  const doc = await readConceptGrouping(fingerprint);
  if (!doc) throw Object.assign(new Error('Concept grouping not found'), { statusCode: 404 });
  return {
    groupingFingerprint: fingerprint,
    groupingStatus: doc.status === 'completed' ? 'ready' : doc.status === 'failed' ? 'failed' : 'processing',
    ...(doc.status === 'superseded' ? { metadataChanged: true } : {}),
    ...(doc.status === 'completed' ? { conceptGroups: doc.result.groups } : {}),
  };
}
