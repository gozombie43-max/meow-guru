import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { protect } from "../middleware/protect.js";
import { getMongoDB, getQuestionsCollection } from "../config/mongodb.js";
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

const router = express.Router();
router.use(protect);
const sessions = () => getMongoDB().collection("trainingSessions");
const examFilter = (exam) => {
  const pattern = new RegExp(`^${exam.split("-").join("[ -]?")}$`, "i");
  return {
    $or: [{ exam: pattern }, { examName: pattern }, { exams: pattern }],
  };
};
const history = (userId, exam) =>
  sessions()
    .find({ userId, exam, status: "completed" })
    .sort({ completedAt: -1 })
    .limit(200)
    .toArray();
const fail = (res, message, status = 400) =>
  res.status(status).json({ error: message });

router.get("/dashboard", async (req, res, next) => {
  try {
    const exam = EXAMS.includes(req.query.exam) ? req.query.exam : EXAMS[0];
    const userId = String(req.user.id);
    const previous = await history(userId, exam);
    let intelligence = buildIntelligence(previous);
    const [active, subjects, topics, mocks] = await Promise.all([
      sessions()
        .find({ userId, exam, status: "active" })
        .sort({ startedAt: -1 })
        .limit(5)
        .project({ id: 1, mode: 1, deadline: 1 })
        .toArray(),
      getQuestionsCollection().distinct("subject", examFilter(exam)),
      getQuestionsCollection().distinct("topic", examFilter(exam)),
      getMongoDB()
        .collection("mockAttempts")
        .find({ userId, examSlug: exam, status: "completed" })
        .sort({ submittedAt: -1 })
        .limit(20)
        .project({ result: 1 })
        .toArray(),
    ]);
    intelligence = readinessWithEvidence(intelligence, previous, topics, mocks);
    // A rebuildable materialized profile; immutable completed sessions remain authoritative.
    await getMongoDB()
      .collection("userSkillProfile")
      .updateOne(
        { _id: `${userId}:${exam}` },
        { $set: { userId, exam, ...intelligence, updatedAt: new Date() } },
        { upsert: true },
      );
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
});

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
router.post("/sessions", async (req, res, next) => {
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
      const existing = await sessions().findOne({
        userId,
        exam: config.exam,
        missionDate,
      });
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
    const filter = { $and: [examFilter(config.exam)] };
    if (config.subject) filter.$and.push({ subject: config.subject });
    if (config.topic)
      filter.$and.push({
        $or: [{ topic: config.topic }, { questionTopic: config.topic }],
      });
    if (config.mode === "review")
      filter.$and.push({
        id: { $in: intelligence.due.map((r) => r.questionId) },
      });
    // Separate indexed retrieval from deterministic ranking. No random sampling and no generated live answer keys.
    const recentIds = previous
      .slice(0, 3)
      .flatMap((s) => s.questions.map((q) => q.id));
    if (config.mode !== "review" && recentIds.length)
      filter.$and.push({ id: { $nin: recentIds } });
    const docs = await getQuestionsCollection()
      .find(filter)
      .sort({ updatedAt: -1, _id: 1 })
      .limit(2000)
      .toArray();
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
      const dueDocs = await getQuestionsCollection()
        .find({
          $and: [
            examFilter(config.exam),
            { id: { $in: intelligence.due.map((r) => r.questionId) } },
          ],
        })
        .limit(100)
        .toArray();
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
      await sessions().insertOne(s);
    } catch (error) {
      if (error.code !== 11000 || config.mode !== "mission") throw error;
      return res.json(
        publicSession(
          await sessions().findOne({ userId, exam: config.exam, missionDate }),
        ),
      );
    }
    res.status(201).json(publicSession(s));
  } catch (e) {
    next(e);
  }
});

router.get("/sessions/:id", async (req, res, next) => {
  try {
    let s = await sessions().findOne({
      id: req.params.id,
      userId: String(req.user.id),
    });
    if (!s) return fail(res, "Session not found", 404);
    if (s.status === "active" && Date.now() >= new Date(s.deadline).getTime()) {
      const updated = transition(s, { type: "finish" });
      const { _id, ...fields } = updated;
      const write = await sessions().updateOne(
        { _id: s._id, revision: s.revision },
        { $set: fields },
      );
      s = write.modifiedCount
        ? updated
        : await sessions().findOne({ _id: s._id });
    }
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
});

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
router.post("/sessions/:id/actions", async (req, res, next) => {
  try {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid session action");
    const s = await sessions().findOne({
      id: req.params.id,
      userId: String(req.user.id),
    });
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
    const { _id, ...fields } = updated;
    const write = await sessions().updateOne(
      { _id: s._id, revision: s.revision },
      { $set: fields },
    );
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    res.json(publicSession(updated));
  } catch (e) {
    next(e);
  }
});

router.post("/sessions/:id/diagnosis", async (req, res, next) => {
  try {
    const s = await sessions().findOne({
      id: req.params.id,
      userId: String(req.user.id),
      status: "completed",
    });
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
    const write = await sessions().updateOne(
      { _id: s._id, revision: s.revision },
      { $set: { "result.diagnosis": diagnosis }, $inc: { revision: 1 } },
    );
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    s.result.diagnosis = diagnosis;
    s.revision++;
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
});

router.patch("/sessions/:id/mistakes", async (req, res, next) => {
  try {
    const parsed = z
      .object({ questionId: z.string().max(200), mistake: z.enum(MISTAKES) })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, "Choose a valid mistake category");
    const s = await sessions().findOne({
      id: req.params.id,
      userId: String(req.user.id),
      status: "completed",
    });
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
    const write = await sessions().updateOne(
      { _id: s._id, revision: s.revision },
      { $set: { answers: s.answers, result: s.result }, $inc: { revision: 1 } },
    );
    if (!write.modifiedCount)
      return fail(res, "Session changed. Reload before continuing.", 409);
    s.revision++;
    res.json(publicSession(s));
  } catch (e) {
    next(e);
  }
});
export default router;
