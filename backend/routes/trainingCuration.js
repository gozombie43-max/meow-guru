import { invalidateQuestionMetadata } from "../services/questions/questionMetadataCache.js";
import express from "express";
import { z } from "zod";
import adminAuth from "../middleware/auth.js";
import { listPendingTrainingVariants, findTrainingSeed, insertTrainingVariant, reviewTrainingVariant } from '../repositories/trainingCurationRepository.js';
import { EXAMS, normalizeQuestion } from "../services/trainingEngine.js";
import { draftTrainingVariant } from "../services/trainingVariants.js";

const router = express.Router();
router.use(adminAuth);
router.get("/variants", async (_req, res, next) => {
  try {
    res.json({
      variants: await listPendingTrainingVariants(),
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
    const seed = await findTrainingSeed(parsed.data.seedId);
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
    await insertTrainingVariant(draft, req.user.id);
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
    const output = await reviewTrainingVariant(req.params.id, req.user.id, parsed.data);
    if (output.status === "validated") await invalidateQuestionMetadata();
    res.json(output);
  } catch (e) {
    next(e);
  }
});
export default router;
