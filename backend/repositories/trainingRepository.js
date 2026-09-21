import { getMongoDB, getQuestionsCollection, withMongoTransaction } from '../config/mongodb.js';
import { normalizeTrainingSubject } from '../services/trainingSubjects.js';
import { cachedTrainingCatalog } from '../services/training/catalogCache.js';
import { trainingExamPattern, trainingSlug, trainingQuestionMetadata } from '../services/training/domain/questionMetadata.js';
import { normalizeQuestion } from '../services/training/domain/questionNormalizer.js';
import { sessionUpdate, orderedTrainingSession } from '../services/training/domain/sessionUpdate.js';

const sessions = () => getMongoDB().collection('trainingSessions');
const reviews = () => getMongoDB().collection('trainingReviewState');
const exposures = () => getMongoDB().collection('trainingQuestionExposure');
const skills = () => getMongoDB().collection('trainingSkillState');

const trainingSubjectFilter = subject => {
  const canonical = normalizeTrainingSubject(subject);
  const aliases = canonical === 'reasoning' ? ['reasoning', 'logical-reasoning'] : [canonical];
  const patterns = aliases.map(alias => alias.split('-')
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s_-]+'));
  return { subject: new RegExp(`^\\s*(?:${patterns.join('|')})\\s*$`, 'i') };
};

const examFilter = exam => {
  // Bank labels also contain tiers, dates, shifts, and combined CGL/CHSL tags.
  // Keep exam boundaries so CGL does not accidentally include CPO or MTS.
  const pattern = trainingExamPattern(exam);
  return { $or: [{ exam: pattern }, { examName: pattern }, { exams: pattern }] };
};

const answerSignal = (correct, confidence) =>
  correct
    ? confidence === 'guess'
      ? 0.25
      : confidence === 'unsure'
        ? 0.6
        : 1
    : 0;

const skillKeysFor = q => [
  {
    key: `${q.subject} / ${q.topic}`,
    level: 'topic',
    label: q.topic,
    subject: q.subject,
    topic: q.topic,
  },
  ...(q.subtopic
    ? [{
        key: `${q.subject} / ${q.topic} / subtopic / ${q.subtopic}`,
        level: 'subtopic',
        label: q.subtopic,
        subject: q.subject,
        topic: q.topic,
      }]
    : []),
  ...(q.concepts || [])
    .filter(c => typeof c === 'string' && c.trim())
    .map(label => ({
      key: `${q.subject} / ${q.topic} / concept / ${label}`,
      level: 'concept',
      label,
      subject: q.subject,
      topic: q.topic,
    })),
];

async function applyCompletedSessionLearning(db, completed, mongoSession) {
  if (!completed?.result || completed.status !== 'completed') return;

  const userId = completed.userId;
  const exam = completed.exam;
  const completedAt = completed.completedAt;
  const attempted = completed.questions
    .map(q => ({ q, answer: completed.answers[q.id] }))
    .filter(({ answer }) => answer && answer.choice !== null);
  if (!attempted.length) return;

  const questionIds = attempted.map(({ q }) => q.id);
  const existingReviews = await db.collection('trainingReviewState')
    .find(
      { userId, exam, questionId: { $in: questionIds } },
      { session: mongoSession },
    )
    .toArray();
  const reviewByQuestion = new Map(
    existingReviews.map(item => [String(item.questionId), item]),
  );

  const exposureOps = [];
  const reviewOps = [];
  const skillInputs = new Map();

  for (const { q, answer } of attempted) {
    const correct = answer.choice === q.correctIndex;
    const risky =
      !correct ||
      answer.confidence === 'guess' ||
      answer.confidence === 'unsure' ||
      answer.seconds > q.expectedTime * 1.5;

    exposureOps.push({
      updateOne: {
        filter: { userId, exam, questionId: q.id },
        update: {
          $set: {
            userId,
            exam,
            questionId: q.id,
            lastSeenAt: completedAt,
            lastCorrect: correct,
            lastSeconds: answer.seconds,
            lastConfidence: answer.confidence || null,
            updatedAt: new Date(),
          },
          $inc: { timesSeen: 1, timesCorrect: Number(correct) },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });

    const existingReview = reviewByQuestion.get(String(q.id));
    const priorReviewStage =
      existingReview?.stage ??
      (Number.isInteger(q.priorReviewStage) ? q.priorReviewStage : null);
    if (risky || existingReview || priorReviewStage !== null) {
      const stage = risky ? 0 : Math.min((priorReviewStage || 0) + 1, 4);
      const reason = !risky
        ? 'Scheduled recall'
        : !correct
          ? answer.confidence === 'sure'
            ? 'Wrong + Sure: possible misconception'
            : 'Wrong answer'
          : answer.seconds > q.expectedTime * 1.5
            ? 'Above target time'
            : 'Low confidence';
      const intervals = [1, 3, 7, 21, 60];
      reviewOps.push({
        updateOne: {
          filter: { _id: `${userId}:${exam}:${q.id}` },
          update: {
            $set: {
              userId,
              exam,
              questionId: q.id,
              topic: q.topic,
              stage,
              dueAt: new Date(
                new Date(completedAt).getTime() + intervals[stage] * 86400000,
              ).toISOString(),
              reason,
              mistake: answer.mistake || existingReview?.mistake || null,
              lastSessionId: completed.id,
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          upsert: true,
        },
      });
    }

    for (const meta of skillKeysFor(q)) {
      const item = skillInputs.get(meta.key) || {
        ...meta,
        attempts: 0,
        correct: 0,
        seconds: [],
        signals: [],
      };
      item.attempts++;
      item.correct += Number(correct);
      item.seconds.push(answer.seconds);
      item.signals.push(answerSignal(correct, answer.confidence));
      skillInputs.set(meta.key, item);
    }
  }

  if (exposureOps.length) {
    await db.collection('trainingQuestionExposure').bulkWrite(
      exposureOps,
      { ordered: false, session: mongoSession },
    );
  }
  if (reviewOps.length) {
    await db.collection('trainingReviewState').bulkWrite(
      reviewOps,
      { ordered: false, session: mongoSession },
    );
  }

  if (!skillInputs.size) return;
  const ids = [...skillInputs.keys()].map(key => `${userId}:${exam}:${key}`);
  const existing = await db.collection('trainingSkillState')
    .find({ _id: { $in: ids } }, { session: mongoSession })
    .toArray();
  const byId = new Map(existing.map(item => [item._id, item]));
  const skillOps = [];

  for (const item of skillInputs.values()) {
    const _id = `${userId}:${exam}:${item.key}`;
    const old = byId.get(_id);
    let mastery =
      old?.mastery ??
      (item.level === 'topic' ? completed.baseline?.[item.key] : undefined) ??
      0.5;
    let seconds = old?.seconds ?? 60;
    for (let i = 0; i < item.signals.length; i++) {
      mastery = 0.8 * mastery + 0.2 * item.signals[i];
      seconds = 0.8 * seconds + 0.2 * item.seconds[i];
    }
    skillOps.push({
      updateOne: {
        filter: { _id },
        update: {
          $set: {
            userId,
            exam,
            key: item.key,
            level: item.level,
            label: item.label,
            subject: item.subject,
            topic: item.topic,
            mastery,
            seconds,
            lastAt: completedAt,
            updatedAt: new Date(),
          },
          $inc: { attempts: item.attempts, correct: item.correct },
          $setOnInsert: { createdAt: new Date() },
        },
        upsert: true,
      },
    });
  }

  if (skillOps.length) {
    await db.collection('trainingSkillState').bulkWrite(
      skillOps,
      { ordered: false, session: mongoSession },
    );
  }
}

export const trainingHistory = (userId, exam) =>
  sessions()
    .find({ userId, exam, status: 'completed' })
    .sort({ completedAt: -1 })
    .limit(50)
    .project({ id: 1, mode: 1, completedAt: 1, completionReason: 1, learningApplied: 1, questionOrder: 1,
      'questions.id': 1, 'questions.subject': 1, 'questions.topic': 1,
      'questions.subtopic': 1, 'questions.concepts': 1, 'questions.correctIndex': 1,
      'questions.expectedTime': 1, 'questions.difficulty': 1, answers: 1,
      'result.score': 1, 'result.maxScore': 1, 'result.accuracy': 1, 'result.correct': 1,
      'result.negativeLoss': 1, 'result.rows.attempted': 1, 'result.rows.correct': 1,
      'result.rows.target': 1, 'result.rows.seconds': 1 })
    .toArray().then(rows => rows.map(orderedTrainingSession));

export const findMission = (userId, exam, missionDate) =>
  sessions().findOne({ userId, exam, missionDate }).then(orderedTrainingSession);

export const findOwnedSession = (id, userId, completed = false) =>
  sessions().findOne({ id, userId, ...(completed ? { status: 'completed' } : {}) }).then(orderedTrainingSession);

export const createTrainingSession = session => sessions().insertOne(session);
export const reloadTrainingSession = id => sessions().findOne({ _id: id }).then(orderedTrainingSession);

export const expiredActiveSessions = (userId, exam, now = Date.now()) =>
  sessions()
    .find({
      userId,
      exam,
      status: 'active',
      deadline: { $lte: new Date(now).toISOString() },
    })
    .limit(20)
    .toArray().then(rows => rows.map(orderedTrainingSession));

export async function trainingLearningState(userId, exam) {
  const [reviewRows, skillRows] = await Promise.all([
    reviews()
      .find({ userId, exam })
      .sort({ dueAt: 1 })
      .limit(2000)
      .toArray(),
    skills()
      .find({ userId, exam })
      .sort({ mastery: 1 })
      .limit(5000)
      .toArray(),
  ]);
  return { reviewRows, skillRows };
}

export async function trainingDashboardData(userId, exam) {
  const nowIso = new Date().toISOString();
  const [active, catalog, mocks, reviewRows, skillRows] = await Promise.all([
    sessions()
      .find({ userId, exam, status: 'active', deadline: { $gt: nowIso } })
      .sort({ startedAt: -1 })
      .limit(5)
      .project({ id: 1, mode: 1, deadline: 1 })
      .toArray(),
    cachedTrainingCatalog(getMongoDB(), `${exam}:${process.env.TRAINING_INDEXED_QUESTIONS === 'true'}`, () => getQuestionsCollection()
      .aggregate([
        { $match: process.env.TRAINING_INDEXED_QUESTIONS === 'true' ? { trainingExamSlugs: exam } : examFilter(exam) },
        {
          $project: {
            subject: { $ifNull: ['$subject', 'Unclassified'] },
            topic: { $ifNull: ['$topic', '$questionTopic'] },
          },
        },
        { $match: { topic: { $type: 'string' } } },
        { $group: { _id: { subject: '$subject', topic: '$topic' } } },
        { $sort: { '_id.subject': 1, '_id.topic': 1 } },
        { $limit: 2000 },
      ])
      .toArray()),
    getMongoDB()
      .collection('mockAttempts')
      .find({ userId, examSlug: exam, status: 'completed' })
      .sort({ submittedAt: -1 })
      .limit(20)
      .project({ result: 1 })
      .toArray(),
    reviews()
      .find({ userId, exam })
      .sort({ dueAt: 1 })
      .limit(2000)
      .toArray(),
    skills()
      .find({ userId, exam })
      .sort({ mastery: 1 })
      .limit(5000)
      .toArray(),
  ]);

  const catalogPairs = [...new Map(catalog.map(item => {
    const pair = {
      subject: normalizeTrainingSubject(item._id.subject),
      topic: item._id.topic,
    };
    return [JSON.stringify([pair.subject, pair.topic]), pair];
  })).values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));
  return { active, catalogPairs, mocks, reviewRows, skillRows };
}

export async function trainingQuestionPool(config, dueIds, recentIds, weakTopics = []) {
  const indexed = process.env.TRAINING_INDEXED_QUESTIONS === 'true';
  const and = [indexed ? { trainingExamSlugs: config.exam, trainingEligible: true, trainingMetadataVersion: 1 } : examFilter(config.exam)];
  const projection = indexed ? { id: 1, trainingCandidate: 1 } : {};
  const query = filter => getQuestionsCollection().find(filter).project(projection);
  if (config.subject) and.push(indexed ? { trainingSubjectSlug: normalizeTrainingSubject(config.subject) } : trainingSubjectFilter(config.subject));
  if (config.topic && indexed) and.push({ $or: [{ trainingTopicSlug: trainingSlug(config.topic) }, { questionTopic: config.topic }] });
  if (config.topic)
    and.push({ $or: [{ topic: config.topic }, { questionTopic: config.topic }] });
  if (config.mode === 'review') {
    and.push({ id: { $in: dueIds } });
    return query({ $and: and })
      .sort({ updatedAt: -1, _id: 1 })
      .limit(500)
      .toArray();
  }
  if (recentIds.length) and.push({ id: { $nin: recentIds } });
  const base = { $and: and };
  const weakFilter = weakTopics.length
    ? { $and: [...and, { $or: [{ topic: { $in: weakTopics } }, { questionTopic: { $in: weakTopics } }] }] }
    : null;

  const [latest, oldest, quality, weak] = await Promise.all([
    query(base).sort({ updatedAt: -1, _id: 1 }).limit(900).toArray(),
    query(base).sort({ updatedAt: 1, _id: 1 }).limit(450).toArray(),
    query(base).sort(indexed ? { 'trainingCandidate.difficulty': -1, 'trainingCandidate.discrimination': -1, updatedAt: -1 } : { difficulty: -1, discrimination: -1, updatedAt: -1 }).limit(900).toArray(),
    weakFilter
      ? query(weakFilter).sort(indexed ? { 'trainingCandidate.discrimination': -1, updatedAt: -1 } : { discrimination: -1, updatedAt: -1 }).limit(1200).toArray()
      : [],
  ]);
  return [...new Map([...weak, ...quality, ...latest, ...oldest].map(q => [String(q.id), q])).values()];
}

export const dueTrainingQuestions = (exam, ids) =>
  getQuestionsCollection()
    .find({ $and: [process.env.TRAINING_INDEXED_QUESTIONS === 'true' ? { trainingExamSlugs: exam, trainingEligible: true, trainingMetadataVersion: 1 } : examFilter(exam), { id: { $in: ids } }] })
    .project(process.env.TRAINING_INDEXED_QUESTIONS === 'true' ? { id: 1, trainingCandidate: 1 } : {})
    .limit(500)
    .toArray();

export const trainingExposureData = (userId, exam, questionIds) =>
  exposures()
    .find({ userId, exam, ...(questionIds ? { questionId: { $in: questionIds } } : {}) })
    .sort({ lastSeenAt: -1 })
    .limit(5000)
    .project({ questionId: 1, timesSeen: 1, timesCorrect: 1, lastSeenAt: 1 })
    .toArray();

// Every session mutation retains the optimistic revision guard. Completion is
// committed atomically with durable skill/review/exposure updates.
export async function commitTrainingTransition(session, updated) {
  if (session.status === 'active' && updated.status === 'completed') updated.learningApplied = true;
  const update = sessionUpdate(session, updated);
  const isCompletion =
    session.status === 'active' && ['completed', 'abandoned'].includes(updated.status);
  if (!isCompletion) {
    return sessions().updateOne(
      { _id: session._id, revision: session.revision },
      update,
    );
  }

  let write = { modifiedCount: 0 };
  await withMongoTransaction(async ({ session: mongoSession, db }) => {
    write = await db.collection('trainingSessions').updateOne(
      { _id: session._id, revision: session.revision },
      update,
      { session: mongoSession },
    );
    if (write.modifiedCount && updated.status === 'completed') {
      await applyCompletedSessionLearning(db, updated, mongoSession);
    }
  });
  return write;
}

export const saveTrainingDiagnosis = (session, diagnosis) =>
  sessions().updateOne(
    { _id: session._id, revision: session.revision },
    { $set: { 'result.diagnosis': diagnosis }, $inc: { revision: 1 } },
  );

export async function saveTrainingMistakes(session) {
  const write = await sessions().updateOne(
    { _id: session._id, revision: session.revision },
    { $set: { answers: session.answers, result: session.result }, $inc: { revision: 1 } },
  );
  if (write.modifiedCount) {
    const changed = session.result.rows.filter(row => row.mistake);
    if (changed.length) {
      await reviews().bulkWrite(changed.map(row => ({ updateOne: {
        filter: { userId: session.userId, exam: session.exam, questionId: row.questionId },
        update: { $set: { mistake: row.mistake, updatedAt: new Date() } },
      } })), { ordered: false });
    }
  }
  return write;
}

export async function hydrateTrainingQuestions(selected) {
  const compact = selected.filter(q => q._trainingDocumentId);
  if (!compact.length) return selected;
  const docs = await getQuestionsCollection().find({ _id: { $in: compact.map(q => q._trainingDocumentId) } }).toArray();
  const byId = new Map(docs.map(doc => [String(doc._id), doc]));
  return selected.map(q => {
    if (!q._trainingDocumentId) return q;
    const doc = byId.get(String(q._trainingDocumentId));
    const full = doc && normalizeQuestion(doc);
    // Eligibility is rechecked for the handful of selected documents in case an
    // editor changed content after ranking. Never substitute a different ID.
    if (!full || full.id !== q.id || JSON.stringify(trainingQuestionMetadata(doc).trainingCandidate) !== q._trainingFingerprint) {
      throw new Error('Question catalog changed. Start a new session.');
    }
    const { _trainingDocumentId, _trainingFingerprint, ...metadata } = q;
    return { ...full, ...metadata };
  });
}
