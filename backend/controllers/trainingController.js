import { randomUUID } from "node:crypto";

import { z } from "zod";

import { trainingHistory as history, findMission, findOwnedSession, createTrainingSession, reloadTrainingSession, trainingDashboardData, saveSkillProfile, trainingQuestionPool, dueTrainingQuestions, commitTrainingTransition, saveTrainingDiagnosis, saveTrainingMistakes } from "../repositories/trainingRepository.js";

import {
  MODES,
  EXAMS,
  MISTAKES,
  normalizeQuestion,
  buildIntelligence,
  selectQuestions,
  publicSession,
  transition,
  readinessWithEvidence,
} from "../services/trainingEngine.js";

import { diagnoseTraining } from "../services/trainingDiagnosis.js";

import { getExamConfig } from "../config/exam-config.js";

const fail = (res, message, status = 400) =>
  res.status(status).json({ error: message });

export const getTrainingDashboard = async (req, res, next) => {
  try {
    const exam = EXAMS.includes(req.query.exam) ? req.query.exam : EXAMS[0];
    const userId = String(req.user.id);
    const previous = await history(userId, exam);
    let intelligence = buildIntelligence(previous);
    const [active, subjects, topics, mocks] = await trainingDashboardData(userId, exam);
    intelligence = readinessWithEvidence(intelligence, previous, topics, mocks);
    // A rebuildable materialized profile; immutable completed sessions remain authoritative.
    await saveSkillProfile(userId, exam, intelligence);
    const weak = intelligence.topics[0];
    const mission = [
      {
        mode: "adaptive",
        count: 10,
        label: weak ? `Strengthen ${weak.topic}` : "Build your skill baseline",
      },
      { mode: "sprint", count: 8, label: "Train execution speed" },
      ...(intelligence.due.length
        ? [
            {
              mode: "review",
              count: Math.min(5, intelligence.due.length),
              label: "Review due mistakes",
            },
          ]
        : []),
      { mode: "section", count: 10, label: "English previous-year practice" },
      { mode: "adaptive", count: 9, label: "Consolidate with a mixed block" },
    ];
    res.json({
      ...intelligence,
      active,
      subjects: subjects.filter((v) => typeof v === "string"),
      catalogTopics: topics.filter((v) => typeof v === "string"),
      mission,
      history: previous.slice(0, 20).map((s) => ({
        id: s.id,
        mode: s.mode,
        at: s.completedAt,
        score: s.result.score,
        maxScore: s.result.maxScore,
        accuracy: s.result.accuracy,
      })),
      personalBest: Math.max(
        0,
        ...previous
          .filter((s) => s.mode === "survival")
          .map((s) => s.result.correct),
      ),
    });
  } catch (e) {
    next(e);
  }
};

const startSchema = z.object({
  mode: z.enum([...MODES, "review", "mission"]),
  exam: z.enum(EXAMS),
  tier: z.enum(["1", "2"]).default("1"),
  subject: z.string().max(100).optional(),
  topic: z.string().max(150).optional(),
  count: z
    .union([
      z.literal(10),
      z.literal(20),
      z.literal(25),
      z.literal(50),
      z.literal("full"),
    ])
    .default(20),
  minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]).default(10),
});

export const startTrainingSession = async (req, res, next) => {
  try {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success)
      return fail(res, "Choose a valid mode, exam and session length.");
    const config = parsed.data,
      userId = String(req.user.id),
      now = Date.now();
    const missionDate = new Date(now).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
    if (config.mode === "mission") {
      const existing = await findMission(userId, config.exam, missionDate);
      if (existing) return res.json(publicSession(existing));
    }
    const previous = await history(userId, config.exam),
      intelligence = buildIntelligence(previous);
    const sectional = ["section", "gauntlet"].includes(config.mode);
    if (sectional && !config.subject)
      return fail(res, "Choose a subject for sectional training.");
    const examConfig = getExamConfig(
      config.exam === "cat" ? "cat" : `${config.exam}-tier${config.tier}`,
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
      return fail(
        res,
        "This subject is not mapped to a section in the selected exam and tier.",
      );
    if (config.count === "full" && (!sectional || !sectionConfig))
      return fail(
        res,
        "Full section requires a subject mapped to the exam configuration.",
      );
    const requestedCount =
      config.count === "full" ? sectionConfig.questionCount : config.count;
    const recentIds = previous.slice(0, 3).flatMap(s => s.questions.map(q => q.id));
    const docs = await trainingQuestionPool(config, intelligence.due.map(r => r.questionId), recentIds);
    const pool = [
      ...new Map(
        docs
          .map(normalizeQuestion)
          .filter(Boolean)
          .map((q) => [q.id, q]),
      ).values(),
    ];
    const eligible =
      config.mode === "nightmare"
        ? pool.filter((q) => q.difficulty >= 3)
        : pool;
    let questions = selectQuestions(
      eligible,
      config.mode,
      requestedCount,
      intelligence,
      now,
    );
    if (config.mode === "mission") {
      const used = new Set();
      questions = [];
      const add = (source, mode, count, label) => {
        const block = selectQuestions(
          source.filter((q) => !used.has(q.id)),
          mode,
          count,
          intelligence,
          now,
        );
        for (const q of block) {
          used.add(q.id);
          questions.push({ ...q, trainingBlock: label });
        }
      };
      add(pool, "adaptive", 10, "Weak-area practice");
      add(pool, "sprint", 8, "Build your pace");
      // Review retrieval is separate so recently seen mistakes remain eligible.
      const dueDocs = await dueTrainingQuestions(config.exam, intelligence.due.map(r => r.questionId));
      add(
        dueDocs.map(normalizeQuestion).filter(Boolean),
        "review",
        5,
        "Due reviews",
      );
      add(
        pool.filter(
          (q) => /english/i.test(q.subject) && q.sourceType === "pyq",
        ),
        "section",
        10,
        "English PYQs",
      );
      add(pool, "adaptive", 9, "Mixed consolidation");
    }
    if (!questions.length)
      return fail(
        res,
        config.mode === "review"
          ? "No review questions are due for these filters."
          : "No eligible questions match this exam and topic. Add exam-tagged questions with valid answer keys, or change the filters.",
        422,
      );
    if (config.count === "full" && questions.length < requestedCount)
      return fail(
        res,
        `This section needs ${requestedCount} eligible questions; only ${questions.length} are available. Choose a shorter session.`,
        422,
      );
    const expected = questions.reduce((n, q) => n + q.expectedTime, 0);
    const duration =
      config.mode === "sprint"
        ? config.minutes * 60
        : Math.max(
            60,
            Math.round(
              expected *
                (config.mode === "pressure"
                  ? 0.7
                  : config.mode === "nightmare"
                    ? 0.85
                    : 1.2),
            ),
          );
    const s = {
      id: randomUUID(),
      userId,
      ...config,
      ...(config.mode === "mission" ? { missionDate } : {}),
      questions,
      baseline: Object.fromEntries(
        intelligence.topics.map((p) => [p.key, p.mastery]),
      ),
      reserve:
        config.mode === "gauntlet"
          ? pool
              .filter(
                (q) => !questions.some((selected) => selected.id === q.id),
              )
              .sort((a, b) => a.difficulty - b.difficulty)
              .slice(0, 100)
          : [],
      answers: {},
      events: [{ type: "visit", questionId: questions[0].id, at: now }],
      marking:
        sectional && sectionConfig
          ? {
              correct: sectionConfig.marking.correct,
              wrong: sectionConfig.marking.incorrect,
            }
          : { correct: 1, wrong: 0.25 },
      duration,
      startedAt: new Date(now).toISOString(),
      deadline: new Date(now + duration * 1000).toISOString(),
      lastEventAt: now,
      current: 0,
      revision: 0,
      lives: config.mode === "survival" ? 3 : 999,
      status: "active",
    };
    try {
      await createTrainingSession(s);
    } catch (error) {
      if (error.code !== 11000 || config.mode !== "mission") throw error;
      return res.json(
        publicSession(
          await findMission(userId, config.exam, missionDate),
        ),
      );
    }
    res.status(201).json(publicSession(s));
  } catch (e) {
    next(e);
  }
};

export const getTrainingSession = async (req, res, next) => {
  try {
    let s = await findOwnedSession(req.params.id, String(req.user.id));
    if (!s) return fail(res, "Session not found", 404);
    if (s.status === "active" && Date.now() >= new Date(s.deadline).getTime()) {
      const updated = transition(s, { type: "finish" });
      const write = await commitTrainingTransition(s, updated);
      s = write.modifiedCount
        ? updated
        : await reloadTrainingSession(s._id);
    }
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
};

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("answer"),
    revision: z.number().int().nonnegative(),
    choice: z.number().int().nullable(),
    confidence: z.enum(["sure", "unsure", "guess"]).nullable().optional(),
  }),
  z.object({
    type: z.literal("visit"),
    revision: z.number().int().nonnegative(),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("finish"),
    revision: z.number().int().nonnegative(),
  }),
]);

export const applyTrainingAction = async (req, res, next) => {
  try {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid session action");
    const s = await findOwnedSession(req.params.id, String(req.user.id));
    if (!s) return fail(res, "Session not found", 404);
    if (s.status === "completed") return res.json(publicSession(s));
    if (s.revision !== parsed.data.revision)
      return fail(res, "Session changed. Reload before continuing.", 409);
    if (s.events.length >= 2000 && parsed.data.type !== "finish")
      return fail(
        res,
        "Session action limit reached. Finish this session.",
        422,
      );
    let updated;
    try {
      updated = transition(s, parsed.data);
    } catch (e) {
      return fail(res, e.message);
    }
    const write = await commitTrainingTransition(s, updated);
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    res.json(publicSession(updated));
  } catch (e) {
    next(e);
  }
};

export const diagnoseTrainingSession = async (req, res, next) => {
  try {
    const s = await findOwnedSession(req.params.id, String(req.user.id), true);
    if (!s) return fail(res, "Completed session not found", 404);
    if (s.result.diagnosis) return res.json(publicSession(s));
    if (!process.env.AZURE_OPENAI_KEY && !process.env.OPENAI_API_KEY)
      return fail(
        res,
        "AI suggestions are not configured. You can still classify mistakes yourself.",
        503,
      );
    const { chatJSON } = await import("../ai/azureClient.js");
    let diagnosis;
    try {
      diagnosis = await diagnoseTraining(s, chatJSON);
    } catch {
      return fail(
        res,
        "AI suggestions are temporarily unavailable. Your results and scoring are saved.",
        502,
      );
    }
    const write = await saveTrainingDiagnosis(s, diagnosis);
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    s.result.diagnosis = diagnosis;
    s.revision++;
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
};

export const updateTrainingMistake = async (req, res, next) => {
  try {
    const parsed = z
      .object({ questionId: z.string().max(200), mistake: z.enum(MISTAKES) })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, "Choose a valid mistake category");
    const s = await findOwnedSession(req.params.id, String(req.user.id), true);
    if (!s) return fail(res, "Completed session not found", 404);
    const { questionId, mistake } = parsed.data;
    if (!s.questions.some((q) => q.id === questionId) || !s.answers[questionId])
      return fail(res, "Answer not found", 404);
    s.answers[questionId].mistake = mistake;
    const row = s.result.rows.find((r) => r.questionId === questionId);
    row.mistake = mistake;
    s.result.failureMap = Object.fromEntries(
      MISTAKES.map((m) => [
        m,
        s.result.rows.filter((r) => r.mistake === m).length,
      ]),
    );
    const write = await saveTrainingMistakes(s);
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    s.revision++;
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
};

