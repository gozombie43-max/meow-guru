import express from "express";
import { z } from "zod";
import { protect } from "../middleware/protect.js";
import { getPushDevicesCollection } from "../config/mongodb.js";

const router = express.Router();

const registerSchema = z.object({
  fid: z.string().trim().min(10).max(256),
  platform: z.enum(["android"]).default("android"),
});

router.post("/register", protect, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid push registration" });
    }

    const { fid, platform } = parsed.data;
    const now = new Date();
    const collection = getPushDevicesCollection();

    await collection.updateOne(
      { fid },
      {
        $set: {
          userId: req.user.id,
          email: req.user.email,
          platform,
          enabled: true,
          updatedAt: now,
          lastSeenAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    return res.status(200).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
