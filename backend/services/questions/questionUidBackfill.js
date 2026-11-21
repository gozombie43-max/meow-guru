import {
  canonicalQuestionUid,
  MISSING_QUESTION_UID_FILTER,
  persistedQuestionUid,
  QUESTION_CANONICAL_IDENTITY_INDEX,
} from './questionIdentity.js';
import {
  ensureIndex,
  listIndexesSafe,
  sameKeySpec,
  sameSemanticOptions,
} from '../../migrations/indexUtils.js';

const DEFAULT_BATCH_SIZE = 500;

export async function verifyQuestionCanonicalIdentityIndex(collection) {
  const indexes = await listIndexesSafe(collection);
  const matched = indexes.find(idx => sameKeySpec(idx.key, QUESTION_CANONICAL_IDENTITY_INDEX.key)) || null;
  if (!matched) {
    return {
      ok: false,
      exists: false,
      name: null,
      unique: false,
      key: null,
      partialFilterExpression: null,
      matchesExpected: false,
      reason: 'missing_index',
    };
  }

  const unique = Boolean(matched.unique);
  const matchesExpected = sameSemanticOptions(matched, QUESTION_CANONICAL_IDENTITY_INDEX.options);
  const strictFullUnique = unique && !matched.partialFilterExpression && !matched.sparse;
  const ok = unique && (matchesExpected || strictFullUnique);
  const reason = !unique
    ? 'not_unique'
    : ok
      ? null
      : 'unexpected_options';

  return {
    ok,
    exists: true,
    name: matched.name,
    unique,
    key: matched.key,
    partialFilterExpression: matched.partialFilterExpression ?? null,
    matchesExpected,
    reason,
  };
}

export async function ensureQuestionCanonicalIdentityIndex(collection) {
  await ensureIndex(
    collection,
    QUESTION_CANONICAL_IDENTITY_INDEX.key,
    QUESTION_CANONICAL_IDENTITY_INDEX.options,
  );
  const verification = await verifyQuestionCanonicalIdentityIndex(collection);
  if (!verification.ok) {
    throw Object.assign(
      new Error(
        `Invalid question_canonical_identity index on "${collection?.collectionName || 'questions'}": ${verification.reason}`,
      ),
      { code: 'INVALID_CANONICAL_IDENTITY_INDEX', index: verification },
    );
  }
  return verification;
}

/**
 * Safely and idempotently backfills missing `questionUid` values on the `questions`
 * collection using `canonicalQuestionUid()`.
 *
 * Guarantees:
 * - Full read-only collision scan runs BEFORE any write; aborts with zero writes on collision.
 * - Never overwrites any existing non-empty string `questionUid` (enforced in both scan and
 *   conditional MongoDB update filter).
 * - Uses bounded `$set: { questionUid }` batches so unrelated fields are untouched and repeated
 *   runs are no-ops.
 */
export async function backfillMissingQuestionUids(
  collection,
  { apply = false, batchSize = DEFAULT_BATCH_SIZE, verifyIndex = true } = {},
) {
  const safeBatchSize = Math.max(1, Math.min(2000, Number(batchSize) || DEFAULT_BATCH_SIZE));
  const missingCount = await collection.countDocuments(MISSING_QUESTION_UID_FILTER);

  if (missingCount === 0) {
    const total = await collection.countDocuments({});
    const index = verifyIndex ? await verifyQuestionCanonicalIdentityIndex(collection) : undefined;
    return {
      apply: Boolean(apply),
      total,
      existing: total,
      candidates: 0,
      matched: 0,
      modified: 0,
      skippedConcurrent: 0,
      collisions: [],
      ...(verifyIndex ? { index } : {}),
    };
  }

  // Phase 1: Scan all documents and validate zero collisions before any write.
  const existingUids = new Map();
  const plannedUids = new Map();
  const planned = [];
  const collisions = [];
  let total = 0;
  let existing = 0;

  const cursor = collection
    .find({}, { projection: { _id: 1, id: 1, questionUid: 1 } })
    .batchSize(safeBatchSize);

  for await (const doc of cursor) {
    total++;
    const currentUid = persistedQuestionUid(doc);
    if (currentUid) {
      existing++;
      if (existingUids.has(currentUid)) {
        collisions.push({
          type: 'existing_duplicate',
          questionUid: currentUid,
          existingDocId: existingUids.get(currentUid),
          candidateDocId: String(doc._id),
        });
      } else {
        existingUids.set(currentUid, String(doc._id));
      }
      continue;
    }

    const derivedUid = canonicalQuestionUid({ _id: doc._id });
    if (plannedUids.has(derivedUid)) {
      collisions.push({
        type: 'derived_duplicate',
        questionUid: derivedUid,
        existingDocId: plannedUids.get(derivedUid),
        candidateDocId: String(doc._id),
      });
      continue;
    }

    plannedUids.set(derivedUid, String(doc._id));
    planned.push({
      _id: doc._id,
      id: doc.id ?? null,
      questionUid: derivedUid,
    });
  }

  for (const item of planned) {
    if (existingUids.has(item.questionUid)) {
      collisions.push({
        type: 'existing_collision',
        questionUid: item.questionUid,
        existingDocId: existingUids.get(item.questionUid),
        candidateDocId: String(item._id),
      });
    }
  }

  const report = {
    apply: Boolean(apply),
    total,
    existing,
    candidates: planned.length,
    matched: 0,
    modified: 0,
    skippedConcurrent: 0,
    collisions,
  };

  if (collisions.length > 0) {
    if (verifyIndex) {
      report.index = await verifyQuestionCanonicalIdentityIndex(collection);
    }
    if (apply) {
      throw Object.assign(
        new Error(`Refusing questionUid backfill: detected ${collisions.length} canonical UID collision(s)`),
        { code: 'QUESTION_UID_COLLISION', report },
      );
    }
    return report;
  }

  // Phase 2: Conditional batched writes (never overwrite existing canonical IDs).
  if (apply && planned.length > 0) {
    for (let offset = 0; offset < planned.length; offset += safeBatchSize) {
      const slice = planned.slice(offset, offset + safeBatchSize);
      const ops = slice.map(item => ({
        updateOne: {
          filter: {
            _id: item._id,
            ...MISSING_QUESTION_UID_FILTER,
          },
          update: {
            $set: { questionUid: item.questionUid },
          },
        },
      }));
      const result = await collection.bulkWrite(ops, { ordered: false });
      const matched = result.matchedCount || 0;
      report.matched += matched;
      report.modified += result.modifiedCount || 0;
      report.skippedConcurrent += Math.max(0, ops.length - matched);
    }
  }

  if (verifyIndex) {
    report.index = await verifyQuestionCanonicalIdentityIndex(collection);
  }

  return report;
}
