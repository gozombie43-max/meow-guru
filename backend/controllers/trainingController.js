import { z } from "zod";
import {
  findOwnedSession,
  reloadTrainingSession,
  commitTrainingTransition,
  saveTrainingDiagnosis,
  saveTrainingMistakes,
} from "../repositories/trainingRepository.js";
import {
  MODES,
  EXAMS,
  MISTAKES,
  publicSession,
  transition,
} from "../services/trainingEngine.js";
import { diagnoseTraining } from "../services/trainingDiagnosis.js";
import { TRAINING_EXAMS, TRAINING_MODE_POLICIES, publicModePolicy } from "../services/trainingModePolicy.js";

import { getTrainingDashboardData } from "../services/training/application/getTrainingDashboard.js";
import { createTrainingSessionCommand } from "../services/training/application/createTrainingSession.js";
import { applyTrainingActionCommand } from "../services/training/application/applyTrainingAction.js";

const fail = (res, message, status = 400) =>
  res.status(status).json({ error: message });

export const getTrainingCapabilities = async (_req, res) => {
  res.json({
    exams: TRAINING_EXAMS,
    modes: Object.fromEntries(
      Object.keys(TRAINING_MODE_POLICIES).map((mode) => [
        mode,
        publicModePolicy(mode),
      ]),
    ),
  });
};

export const getTrainingDashboard = async (req, res, next) => {
  try {
    const exam = EXAMS.includes(req.query.exam) ? req.query.exam : EXAMS[0];
    const userId = String(req.user.id);
    const data = await getTrainingDashboardData(userId, exam);
    res.json(data);
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
      
    const session = await createTrainingSessionCommand(userId, config, now);
    res.status(201).json(publicSession(session));
  } catch (e) {
    if (e.message.includes("section needs") || e.message.includes("No eligible questions") || e.message.includes("Choose a subject") || e.message.includes("mapped to a section")) {
      return fail(res, e.message, 422);
    }
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
  z.object({
    type: z.literal("abandon"),
    revision: z.number().int().nonnegative(),
  }),
]);

export const applyTrainingAction = async (req, res, next) => {
  try {
    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid session action");
    
    const updated = await applyTrainingActionCommand(String(req.user.id), req.params.id, parsed.data);
    res.json(publicSession(updated));
  } catch (e) {
    if (e.message === "Session not found") return fail(res, e.message, 404);
    if (e.message.includes("Session changed")) return fail(res, e.message, 409);
    if (e.message.includes("Session action limit")) return fail(res, e.message, 422);
    
    // Other transition errors
    if (e.message === "Invalid answer" || e.message === "Invalid confidence" || e.message === "Invalid question" || e.message.includes("moves forward only") || e.message.includes("inside the current block")) {
      return fail(res, e.message);
    }
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

