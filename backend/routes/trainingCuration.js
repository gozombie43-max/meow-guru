import express from "express";
import { z } from "zod";
import adminAuth from "../middleware/auth.js";
import {
  getMongoDB,
  getQuestionsCollection,
  withMongoTransaction,
} from "../config/mongodb.js";
import { EXAMS, normalizeQuestion } from "../services/trainingEngine.js";
import { draftTrainingVariant } from "../services/trainingVariants.js";

const router = express.Router();
router.use(adminAuth);
router.get("/variants", async (_req, res, next) => {
  try {
    res.json({
      variants: await getMongoDB()
        .collection("trainingQuestionVariants")
        .find({ validationStatus: "pending_review" })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray(),
    });
  } catch (e) {
    next(e);
  }
});
router.post("/variants", async (req, res, next) => {
  try {
    const parsed = z
      .object({ seedId: z.string().max(200), exam: z.enum(EXAMS) })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "Choose a seed question and exam." });
    const seed = await getQuestionsCollection().findOne({
      id: parsed.data.seedId,
    });
    if (!seed || !normalizeQuestion(seed))
      return res.status(422).json({ error: "A valid bank seed is required." });
    const tags = [
      seed.exam,
      seed.examName,
      ...(Array.isArray(seed.exams) ? seed.exams : []),
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase().replaceAll(" ", "-"));
    if (!tags.includes(parsed.data.exam))
      return res
        .status(422)
        .json({ error: "Seed exam metadata does not match the target exam." });
    if (!process.env.AZURE_OPENAI_KEY && !process.env.OPENAI_API_KEY)
      return res
        .status(503)
        .json({ error: "AI generation is not configured." });
    const { chatJSON } = await import("../ai/azureClient.js");
    let draft;
    try {
      draft = await draftTrainingVariant(seed, parsed.data.exam, chatJSON);
    } catch {
      return res
        .status(502)
        .json({
          error:
            "The provider did not return a valid draft. No question was published.",
        });
    }
    await getMongoDB()
      .collection("trainingQuestionVariants")
      .insertOne({ ...draft, createdBy: String(req.user.id) });
    res.status(201).json(draft);
  } catch (e) {
    next(e);
  }
});
router.post("/variants/:id/review", async (req, res, next) => {
  try {
    const parsed = z
      .object({
        decision: z.enum(["approve", "reject"]),
        verifiedAnswer: z.number().int().nonnegative().optional(),
        verificationNotes: z.string().min(20).max(3000),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({
          error: "Provide a decision and substantive verification notes.",
        });
    let output;
    await withMongoTransaction(async ({ db, session }) => {
      const drafts = db.collection("trainingQuestionVariants");
      const draft = await drafts.findOne({ id: req.params.id }, { session });
      if (!draft)
        throw Object.assign(new Error("Variant not found"), {
          statusCode: 404,
        });
      if (draft.validationStatus !== "pending_review") {
        output = { id: draft.id, status: draft.validationStatus };
        return;
      }
      if (parsed.data.decision === "approve") {
        if (
          parsed.data.verifiedAnswer === undefined ||
          parsed.data.verifiedAnswer >= draft.options.length
        )
          throw Object.assign(
            new Error("Select the independently verified answer index"),
            { statusCode: 400 },
          );
        const { _id, createdBy, ...question } = draft;
        await db
          .collection("questions")
          .insertOne(
            {
              ...question,
              correctAnswer: parsed.data.verifiedAnswer,
              validationStatus: "validated",
              validatedBy: String(req.user.id),
              validatedAt: new Date(),
              updatedAt: new Date(),
              verificationNotes: parsed.data.verificationNotes,
            },
            { session },
          );
      }
      const status =
        parsed.data.decision === "approve" ? "validated" : "rejected";
      await drafts.updateOne(
        { _id: draft._id },
        {
          $set: {
            validationStatus: status,
            reviewedBy: String(req.user.id),
            reviewedAt: new Date(),
            verificationNotes: parsed.data.verificationNotes,
          },
        },
        { session },
      );
      output = { id: draft.id, status };
    });
    res.json(output);
  } catch (e) {
    next(e);
  }
});
export default router;
