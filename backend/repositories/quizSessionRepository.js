import { getMongoDB, withMongoTransaction } from '../config/mongodb.js';

const COLLECTION_NAME = 'quizSessions';
const IDEMPOTENCY_COLLECTION = 'idempotencyRecords';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function fail(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

function isStandaloneTransactionError(error) {
  return (
    error?.code === 20 ||
    /Transaction numbers are only allowed on a replica set/i.test(error?.message || '')
  );
}

function isRetryableCommitError(error) {
  return (
    error?.retryable === true ||
    error?.code === 11000 ||
    error?.code === 112 ||
    error?.codeName === 'WriteConflict' ||
    (typeof error?.hasErrorLabel === 'function' && error.hasErrorLabel('TransientTransactionError'))
  );
}

async function runInOptionalTransaction(work) {
  try {
    return await withMongoTransaction(work);
  } catch (error) {
    if (isStandaloneTransactionError(error)) {
      return work({ db: getMongoDB(), session: undefined });
    }
    throw error;
  }
}

export function getQuizSessionsCollection(db = getMongoDB()) {
  return db.collection(COLLECTION_NAME);
}

export async function insertQuizSession(doc) {
  await getQuizSessionsCollection().insertOne(doc);
  return doc;
}

export async function findQuizSessionById(sessionId, options = {}) {
  return getQuizSessionsCollection().findOne({ sessionId: String(sessionId) }, options);
}

export async function findOwnedQuizSession(sessionId, userId, options = {}) {
  const doc = await findQuizSessionById(sessionId, options);
  if (!doc) return null;
  if (String(doc.userId) !== String(userId)) {
    throw fail('You do not have access to this quiz session', 403, 'FORBIDDEN_SESSION');
  }
  return doc;
}

export async function updateQuizSessionDelivery(
  sessionId,
  userId,
  { newDeliveredUids = [], newLegacyDocIds = null, cursorOffset, lastCursor, selectionCursor, batchNumber, hasMore, now = new Date() },
) {
  const sessions = getQuizSessionsCollection();
  const baseFilter = { sessionId: String(sessionId), userId: String(userId), status: 'in_progress' };

  const legacySetEntries = {};
  if (newLegacyDocIds && typeof newLegacyDocIds === 'object') {
    for (const [uid, docId] of Object.entries(newLegacyDocIds)) {
      if (/^[a-zA-Z0-9_-]+$/.test(uid) && typeof docId === 'string' && /^[a-fA-F0-9]{24}$/.test(docId)) {
        legacySetEntries[`legacyQuestionDocIds.${uid}`] = docId;
      }
    }
  }
  const hasLegacySet = Object.keys(legacySetEntries).length > 0;

  // Monotonically advance cursor metadata only when this batch progresses past the stored cursorOffset,
  // so idempotent HTTP retries of an older cursor never regress lastCursor/hasMore/batchNumber backwards.
  const canAdvance = Number.isInteger(cursorOffset);
  if (canAdvance) {
    const advanceFilter = {
      ...baseFilter,
      $or: [
        { cursorOffset: { $lt: cursorOffset } },
        { cursorOffset: { $exists: false } },
      ],
    };
    const advanceUpdate = {
      $set: {
        updatedAt: now,
        cursorOffset,
        ...(lastCursor !== undefined ? { lastCursor } : {}),
        ...(selectionCursor !== undefined ? { selectionCursor } : {}),
        ...(batchNumber !== undefined ? { batchNumber } : {}),
        ...(hasMore !== undefined ? { hasMore } : {}),
        ...legacySetEntries,
      },
      ...(newDeliveredUids.length > 0 ? { $addToSet: { deliveredUids: { $each: newDeliveredUids } } } : {}),
    };
    const advanced = await sessions.updateOne(advanceFilter, advanceUpdate);
    if (advanced.matchedCount > 0 || (newDeliveredUids.length === 0 && !hasLegacySet)) {
      return advanced;
    }
  }

  if (newDeliveredUids.length > 0 || hasLegacySet) {
    return sessions.updateOne(baseFilter, {
      ...(newDeliveredUids.length > 0 ? { $addToSet: { deliveredUids: { $each: newDeliveredUids } } } : {}),
      $set: { updatedAt: now, ...legacySetEntries },
    });
  }
  return { matchedCount: 0, modifiedCount: 0 };
}

function replayIdempotentRecord(record, fingerprint) {
  if (record.fingerprint !== fingerprint) {
    throw fail('Idempotency key was used with different input', 409, 'IDEMPOTENCY_CONFLICT');
  }
  if (record.status !== 'completed') {
    throw fail('Request outcome is pending reconciliation', 409, 'IDEMPOTENCY_PENDING');
  }
  return {
    response: { ...record.response, idempotent: true },
    replayed: true,
  };
}

/**
 * Atomically persist an idempotent answer inside a MongoDB transaction.
 * Guarantees:
 * - Concurrent duplicate Idempotency-Key replays winner response with zero double-mutation.
 * - Answers are strictly keyed by questionUid so different keys for the same questionUid
 *   never inflate answeredCount or score.
 */
export async function commitQuizSessionAnswerAtomic({
  sessionId,
  userId,
  idempotencyId,
  fingerprint,
  questionUid,
  buildAnswerOutcome,
  now = new Date(),
}) {
  const dbRoot = getMongoDB();
  const journal = dbRoot.collection(IDEMPOTENCY_COLLECTION);
  const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const committed = await runInOptionalTransaction(async ({ db, session }) => {
        const txOpts = session ? { session } : {};
        const records = db.collection(IDEMPOTENCY_COLLECTION);
        const sessions = db.collection(COLLECTION_NAME);

        // Without multi-doc transactions (standalone MongoDB), reserve a pending record
        // first so failures can roll back the idempotency slot cleanly. Inside a replica-set
        // transaction, a single completed insert at the end aborts atomically on 11000.
        if (!session) {
          await records.insertOne({
            _id: idempotencyId,
            fingerprint,
            status: 'pending',
            createdAt: now,
            expiresAt,
          });
        }

        let committedSessionMutation = false;
        try {
          // Read authoritative session state inside the transaction (or standalone session).
          const sessionDoc = await sessions.findOne(
            { sessionId: String(sessionId) },
            {
              ...txOpts,
              projection: {
                _id: 0,
                sessionId: 1,
                userId: 1,
                mode: 1,
                status: 1,
                deadlineAt: 1,
                orderedQuestionUids: 1,
                revision: 1,
                answeredCount: 1,
                answers: 1,
              },
            },
          );
          if (!sessionDoc) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
          if (String(sessionDoc.userId) !== String(userId)) {
            throw fail('You do not have access to this quiz session', 403, 'FORBIDDEN_SESSION');
          }
          if (sessionDoc.status !== 'in_progress') {
            throw fail('Quiz session is already completed', 409, 'SESSION_NOT_ACTIVE');
          }
          if (sessionDoc.deadlineAt) {
            const deadlineMs = new Date(sessionDoc.deadlineAt).getTime();
            if (Number.isFinite(deadlineMs) && now.getTime() > deadlineMs) {
              throw fail('Quiz session time has expired', 409, 'SESSION_EXPIRED');
            }
          }

          // Build mode-aware answer entry & response payload.
          const currentAnswers =
            sessionDoc.answers && typeof sessionDoc.answers === 'object' ? sessionDoc.answers : {};
          const existingEntry = Object.hasOwn(currentAnswers, questionUid)
            ? currentAnswers[questionUid]
            : null;

          const outcome = await buildAnswerOutcome({ sessionDoc, existingEntry });

          if (!outcome.skipMutation) {
            const existingCount = Object.keys(currentAnswers).length;
            const nextAnsweredCount = existingEntry ? existingCount : existingCount + 1;
            const nextRevision = (Number(sessionDoc.revision) || 0) + 1;
            const canUseDotPath =
              typeof questionUid === 'string' && questionUid.length > 0 && !/[.$]/.test(questionUid);
            const setFields = canUseDotPath
              ? {
                  [`answers.${questionUid}`]: outcome.answerEntry,
                  answeredCount: nextAnsweredCount,
                  revision: nextRevision,
                  updatedAt: now,
                }
              : {
                  answers: { ...currentAnswers, [questionUid]: outcome.answerEntry },
                  answeredCount: nextAnsweredCount,
                  revision: nextRevision,
                  updatedAt: now,
                };

            const updateResult = await sessions.updateOne(
              {
                sessionId: String(sessionId),
                userId: String(userId),
                status: 'in_progress',
                revision: Number(sessionDoc.revision) || 0,
              },
              { $set: setFields },
              txOpts,
            );

            if (!updateResult.matchedCount) {
              throw Object.assign(new Error('Session revision changed concurrently'), {
                retryable: true,
                statusCode: 409,
                code: 'REVISION_CONFLICT',
              });
            }

            committedSessionMutation = true;
            outcome.response.revision = nextRevision;
            outcome.response.answeredCount = nextAnsweredCount;
          } else {
            outcome.response.revision = Number(sessionDoc.revision) || 0;
            outcome.response.answeredCount = Object.keys(currentAnswers).length;
          }

          if (session) {
            await records.insertOne(
              {
                _id: idempotencyId,
                fingerprint,
                status: 'completed',
                response: outcome.response,
                createdAt: now,
                completedAt: now,
                expiresAt,
              },
              txOpts,
            );
          } else {
            await records.updateOne(
              { _id: idempotencyId },
              {
                $set: {
                  status: 'completed',
                  response: outcome.response,
                  completedAt: now,
                },
              },
            );
          }

          return { response: outcome.response, replayed: false };
        } catch (innerError) {
          // In standalone MongoDB fallback (no transaction session), clean up the pending
          // reservation whenever validation or optimistic concurrency fails before mutating the session.
          if (!session && !committedSessionMutation) {
            await records.deleteOne({ _id: idempotencyId, status: 'pending' }).catch(() => {});
          }
          throw innerError;
        }
      });
      return committed;
    } catch (error) {
      if (!isRetryableCommitError(error)) throw error;
      const winner = await journal.findOne({ _id: idempotencyId });
      if (winner) {
        if (winner.status === 'completed') return replayIdempotentRecord(winner, fingerprint);
        if (winner.fingerprint !== fingerprint) {
          throw fail('Idempotency key was used with different input', 409, 'IDEMPOTENCY_CONFLICT');
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 15 + attempt * 15));
    }
  }

  const finalWinner = await journal.findOne({ _id: idempotencyId });
  if (finalWinner && finalWinner.status === 'completed') {
    return replayIdempotentRecord(finalWinner, fingerprint);
  }
  throw fail('Session answer changed concurrently; retry submission', 409, 'CONCURRENT_ANSWER_CONFLICT');
}

export async function commitQuizSessionSubmitAtomic({
  sessionId,
  userId,
  reason = 'manual',
  computeResult,
  now = new Date(),
}) {
  const sessions = getQuizSessionsCollection();

  for (let attempt = 0; attempt < 6; attempt++) {
    const doc = await findOwnedQuizSession(sessionId, userId);
    if (!doc) throw fail('Quiz session not found', 404, 'SESSION_NOT_FOUND');
    if (doc.status === 'completed') {
      return { session: doc, idempotent: true };
    }

    const result = await computeResult(doc);
    const nextRevision = (Number(doc.revision) || 0) + 1;
    const updated = await sessions.findOneAndUpdate(
      {
        sessionId: String(sessionId),
        userId: String(userId),
        status: 'in_progress',
        revision: Number(doc.revision) || 0,
      },
      {
        $set: {
          status: 'completed',
          submittedAt: now,
          submitReason: reason,
          result,
          revision: nextRevision,
          hasMore: false,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' },
    );

    if (updated) {
      return { session: updated, idempotent: false };
    }
  }

  const latest = await findOwnedQuizSession(sessionId, userId);
  if (latest?.status === 'completed') {
    return { session: latest, idempotent: true };
  }
  throw fail('Session changed during submit; retry submission', 409, 'CONCURRENT_SUBMIT_CONFLICT');
}
