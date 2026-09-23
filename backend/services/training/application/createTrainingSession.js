import { randomUUID } from "node:crypto";
import {
  trainingHistory as history,
  findMission,
  createTrainingSession as insertTrainingSession,
  trainingQuestionPool,
  trainingExposureData,
  trainingLearningState,
  dueTrainingQuestions,
  hydrateTrainingQuestions,
} from "../../../repositories/trainingRepository.js";
import {
  normalizeQuestion,
  buildIntelligence,
  selectQuestions,
  mergeDurableIntelligence,
} from "../../trainingEngine.js";
import { getExamConfig } from "../../../config/exam-config.js";
import { getTrainingModePolicy } from "../../trainingModePolicy.js";
import { planDailyMission } from "../mission/missionPlanner.js";
import { logger, hashId } from "../../../infrastructure/logger.js";

export async function createTrainingSessionCommand(userId, config, now) {
  const missionDate = new Date(now).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
  if (config.mode === "mission") {
    const existing = await findMission(userId, config.exam, missionDate);
    if (existing) return { session: existing, isNew: false };
  }
  const creationStart = performance.now();
  const [previous, durable] = await Promise.all([history(userId, config.exam), trainingLearningState(userId, config.exam)]);
  let intelligence = mergeDurableIntelligence(
    buildIntelligence(previous, now, durable.stateMeta?.version === 1 && durable.stateMeta?.status === 'ready'),
    durable.skillRows,
    durable.reviewRows,
  );
  const policy = getTrainingModePolicy(config.mode);
  const sectional = policy.sectional;
  if (sectional && !config.subject)
    throw new Error("Choose a subject for sectional training.");
  const examConfig = getExamConfig(
    config.exam === "cat" ? "cat" : `${config.exam}-tier${config.tier || 1}`,
  );
  const normalizedSubject = (config.subject || "")
    .toLowerCase()
    .replaceAll(" ", "-");
  const sectionConfig = examConfig?.sections.find(
    (section) =>
      section.topics.includes(normalizedSubject) ||
      section.label.toLowerCase() === (config.subject || "").toLowerCase(),
  );
  if (sectional && !sectionConfig)
    throw new Error("This subject is not mapped to a section in the selected exam and tier.");
  if (config.count === "full" && (!sectional || !sectionConfig))
    throw new Error("Full section requires a subject mapped to the exam configuration.");
  
  const requestedCount = config.count === "full" ? sectionConfig.questionCount : config.count;
  const recentIds = previous.slice(0, 3).flatMap((s) => s.questions.map((q) => q.id));

  
  const preparationStart = performance.now();
  
  const poolStart = performance.now();
  const docs = await trainingQuestionPool(
    config,
    intelligence.due.map((r) => r.questionId),
    recentIds,
    intelligence.topics.slice(0, 6).map((item) => item.topic),
  );
  
  const asCandidate = doc => doc.trainingCandidate ? { ...doc.trainingCandidate, _trainingDocumentId: doc._id, _trainingFingerprint: JSON.stringify(doc.trainingCandidate) } : normalizeQuestion(doc);
  const pool = [
    ...new Map(
      docs
        .map(asCandidate)
        .filter(Boolean)
        .map((q) => [q.id, q]),
    ).values(),
  ];
  
  const dueDocs = config.mode === 'mission'
    ? await dueTrainingQuestions(config.exam, intelligence.due.map(r => r.questionId)) : [];
  const duePool = dueDocs.map(asCandidate).filter(Boolean);
  const exposureRows = await trainingExposureData(userId, config.exam, [...new Set([...pool, ...duePool].map(q => q.id))]);

  const eligible = pool.filter(
    (q) => q.difficulty >= (policy.minDifficulty || 1),
  );
  
  let questions = [];
  if (config.mode === "mission") {
    
    const poolDuration = Math.round(performance.now() - poolStart);
    logger.info({ event: "training.question_pool.duration_ms", durationMs: poolDuration, poolSize: pool.length, mode: config.mode });
    
    const selectStart = performance.now();
    questions = planDailyMission({ intelligence, pool, duePool, now, exposureRows });
    const selectDuration = Math.round(performance.now() - selectStart);
    logger.info({ event: "training.selection.duration_ms", durationMs: selectDuration, mode: config.mode });
  } else {
    const poolDuration = Math.round(performance.now() - poolStart);
    logger.info({ event: "training.question_pool.duration_ms", durationMs: poolDuration, poolSize: pool.length, mode: config.mode });
    
    const selectStart = performance.now();
    questions = selectQuestions(
      eligible,
      config.mode,
      requestedCount,
      intelligence,
      now,
      exposureRows,
    );
    const selectDuration = Math.round(performance.now() - selectStart);
    logger.info({ event: "training.selection.duration_ms", durationMs: selectDuration, mode: config.mode });
  }
  
  const reviewState = new Map(
    intelligence.reviews.map((item) => [String(item.questionId), item]),
  );
  
  questions = questions.map((question) => {
    const review = reviewState.get(String(question.id));
    return review
      ? { ...question, priorReviewStage: review.stage }
      : question;
  });

  const preparationDuration = Math.round(performance.now() - preparationStart);

  if (!questions.length) {
    logger.info({
      event: "training.selection.empty_pool",
      durationMs: preparationDuration,
      poolSize: pool.length,
      mode: config.mode,
    }, "Empty question pool for selection");
    if (config.mode === "review") throw new Error("No review questions are due for these filters.");
    else throw new Error("No eligible questions match this exam and topic. Add exam-tagged questions with valid answer keys, or change the filters.");
  }

  logger.info({
    event: "training.session.prepare.duration_ms",
    durationMs: preparationDuration,
    poolSize: pool.length,
    selectedSize: questions.length,
    mode: config.mode,
  }, "Questions prepared for training");

  if (config.count === "full" && questions.length < requestedCount)
    throw new Error(`This section needs ${requestedCount} eligible questions; only ${questions.length} are available. Choose a shorter session.`);
    
  const expected = questions.reduce((n, q) => n + q.expectedTime, 0);
  const duration =
    policy.clock === "fixed"
      ? config.minutes * 60
      : Math.max(
          60,
          Math.round(expected * (policy.clockMultiplier || 1.2)),
        );
        
  const reserve = config.mode === 'gauntlet'
    ? pool.filter(q => !questions.some(selected => selected.id === q.id))
      .sort((a, b) => a.difficulty - b.difficulty).slice(0, 100) : [];
  const hydrated = await hydrateTrainingQuestions([...questions, ...reserve]);
  const hydratedQuestions = hydrated.slice(0, questions.length);
  const hydratedReserve = hydrated.slice(questions.length);
  const s = {
    id: randomUUID(),
    userId,
    ...config,
    ...(config.mode === "mission" ? { missionDate } : {}),
    questions: hydratedQuestions,
    baseline: Object.fromEntries(
      intelligence.topics.map((p) => [p.key, p.mastery]),
    ),
    reserve: hydratedReserve,
    answers: {},
    events: [{ type: "visit", questionId: questions[0].id, at: now }],
    marking:
      sectional && sectionConfig
        ? {
            correct: sectionConfig.marking.correct,
            wrong: sectionConfig.marking.incorrect,
          }
        : examConfig
          ? {
              correct: examConfig.sections[0].marking.correct,
              wrong: examConfig.sections[0].marking.incorrect,
            }
          : { correct: 2, wrong: 0.5 },
    duration,
    startedAt: new Date(now).toISOString(),
    deadline: new Date(now + duration * 1000).toISOString(),
    lastEventAt: now,
    current: 0,
    revision: 0,
    lives: policy.lives || 999,
    status: "active",
  };
  
  try {
    await insertTrainingSession(s);
  } catch (error) {
    if (error.code !== 11000 || config.mode !== "mission") throw error;
    const existing = await findMission(userId, config.exam, missionDate);
    if (!existing) throw error;
    return { session: existing, isNew: false };
  }
  
  logger.info({
    event: "training.session.created",
    durationMs: Math.round(performance.now() - creationStart),
    sessionId: s.id,
    userId: hashId(userId),
    mode: config.mode,
  }, "Training session created");
  
  logger.info({ event: 'training.session.create.duration_ms', durationMs: Math.round(performance.now() - creationStart), mode: config.mode });
  return { session: s, isNew: true };
}
