import express from "express";
import { z } from "zod";

import {
  protect,
} from "../middleware/protect.js";

import {
  requireRole,
} from "../middleware/requireRole.js";

import {
  getExamUpdatesCollection,
} from "../config/mongodb.js";

import {
  publishExamUpdate,
} from "../services/examUpdateService.js";

const router =
  express.Router();

const schema =
  z.object({
    examSlug:
      z.string()
        .trim()
        .min(1)
        .max(80),

    type:
      z.enum([
        "application",
        "exam-date",
        "admit-card",
        "answer-key",
        "result",
        "syllabus",
        "other",
      ]),

    title:
      z.string()
        .trim()
        .min(1)
        .max(120),

    message:
      z.string()
        .trim()
        .min(1)
        .max(500),

    route:
      z.string()
        .trim()
        .optional(),

    sourceUrl:
      z.string()
        .url()
        .optional()
        .nullable(),
  });

router.post(
  "/",
  protect,
  requireRole(
    "admin",
    "superadmin"
  ),
  async (
    req,
    res,
    next
  ) => {
    try {
      const parsed =
        schema.safeParse(
          req.body
        );

      if (
        !parsed.success
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid exam update",
          });
      }

      const result =
        await publishExamUpdate({
          ...parsed.data,

          createdByUserId:
            req.user.id,

          createdByEmail:
            req.user.email,
        });

      return res.json({
        ok: true,
        ...result,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/",
  async (
    req,
    res,
    next
  ) => {
    try {
      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );

      const limit =
        Math.min(
          50,
          Math.max(
            1,
            Number(req.query.limit) || 20
          )
        );

      const examSlug =
        req.query.examSlug
          ? String(req.query.examSlug).trim()
          : null;

      const filter =
        examSlug
          ? { examSlug }
          : {};

      const collection =
        getExamUpdatesCollection();

      const [items, total] =
        await Promise.all([
          collection
            .find(filter)
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
          collection.countDocuments(filter),
        ]);

      return res.json({
        items,
        total,
        page,
        limit,
        totalPages:
          Math.ceil(total / limit) || 1,
      });

    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/:examSlug",
  async (
    req,
    res,
    next
  ) => {
    try {
      const examSlug =
        String(req.params.examSlug).trim();

      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );

      const limit =
        Math.min(
          50,
          Math.max(
            1,
            Number(req.query.limit) || 20
          )
        );

      const collection =
        getExamUpdatesCollection();

      const filter =
        { examSlug };

      const [items, total] =
        await Promise.all([
          collection
            .find(filter)
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray(),
          collection.countDocuments(filter),
        ]);

      return res.json({
        items,
        total,
        page,
        limit,
        totalPages:
          Math.ceil(total / limit) || 1,
      });

    } catch (error) {
      next(error);
    }
  }
);

export default router;
