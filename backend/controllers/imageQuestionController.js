import sharp from "sharp";
import pLimit from "p-limit";
import {
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Client, B2_BUCKET } from "../config/b2.js";
import { getQuestionsCollection } from "../config/mongodb.js";

const IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const QUESTION_PREFIX = "question-images";
const SOLUTION_PREFIX = "solution-images";

// Stable image URL helpers
const imageIdFromKey = (key) =>
  Buffer.from(key, "utf8").toString("base64url");

const keyFromImageId = (id) => {
  try {
    return Buffer.from(String(id), "base64url").toString("utf8");
  } catch {
    return null;
  }
};

const BACKEND_PUBLIC_URL = String(
  process.env.BACKEND_PUBLIC_URL || ''
).replace(/\/+$/, '');

const buildImageUrl = (key) => {
  const path =
    `/api/upload/image/${imageIdFromKey(key)}`;

  return BACKEND_PUBLIC_URL
    ? `${BACKEND_PUBLIC_URL}${path}`
    : path;
};

const uploadToB2 = async ({ key, body, contentType }) => {
  await b2Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: body,
      ContentLength: body.length,
      ContentType: contentType,
      CacheControl: IMAGE_CACHE_CONTROL,
    })
  );
};

// GET /api/upload/image/:id
// Redirect browser to short-lived private B2 URL
export const serveImage = async (req, res) => {
  try {
    const key = keyFromImageId(req.params.id);

    if (
      !key ||
      !(
        key.startsWith(`${QUESTION_PREFIX}/`) ||
        key.startsWith(`${SOLUTION_PREFIX}/`) ||
        key.startsWith("notes/images/")
      )
    ) {
      return res.status(404).json({ error: "Image not found" });
    }

    const url = await getSignedUrl(
      b2Client,
      new GetObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
      }),
      { expiresIn: 60 * 60 }
    );

    return res.redirect(302, url);
  } catch (err) {
    console.error("serveImage error:", err);
    return res
      .status(500)
      .json({
        error: "Failed to load image",
      });
  }
};

// POST /api/upload/image-question
export const uploadImageQuestion = async (req, res) => {
  try {
    const file = req.files?.questionImage?.[0];
    if (!file) {
      return res.status(400).json({ error: "Question image required" });
    }

    const {
      topic,
      chapter,
      difficulty,
      correctLetter,
      solution,
      optionRegions,
      subject,
      quizName,
    } = req.body;

    const normalizedTopic =
      typeof topic === "string" && topic.trim()
        ? topic.trim()
        : "visual_reasoning";
    const normalizedChapter =
      typeof chapter === "string" && chapter.trim()
        ? chapter.trim()
        : normalizedTopic;
    const questionId = `${normalizedTopic}_${Date.now()}`;

    const compressed = await sharp(file.buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer();

    /*
     * Existing Azure object: questionId/question.webp
     * Migrated B2 object: question-images/questionId/question.webp
     */
    const key = `${QUESTION_PREFIX}/${questionId}/question.webp`;

    await uploadToB2({
      key,
      body: compressed,
      contentType: "image/webp",
    });

    const questionImageUrl = buildImageUrl(key);
    let regions = optionRegions ? JSON.parse(optionRegions) : null;
    const defaultRegions = {
      a: { x: 0, y: 0.6, w: 0.5, h: 0.2 },
      b: { x: 0.5, y: 0.6, w: 0.5, h: 0.2 },
      c: { x: 0, y: 0.8, w: 0.5, h: 0.2 },
      d: { x: 0.5, y: 0.8, w: 0.5, h: 0.2 },
    };

    const regionKeys =
      regions && typeof regions === "object" && !Array.isArray(regions)
        ? Object.keys(regions)
        : [];

    if (!regions || regionKeys.length < 4) {
      regions = { ...defaultRegions, ...(regions || {}) };
    }

    const doc = {
      id: questionId,
      questionType: "image_mcq",
      subject: subject || null,
      topic: normalizedTopic,
      quizName: quizName || null,
      chapter: normalizedChapter,
      difficulty: difficulty || "medium",
      questionImage: questionImageUrl,
      // Keep the key in case the URL format changes later.
      questionImageKey: key,
      optionRegions: regions,
      correctLetter,
      solution: solution || "",
      createdAt: new Date().toISOString(),
    };

    const questions = getQuestionsCollection();
    await questions.insertOne(doc);

    return res.status(201).json({
      success: true,
      questionId,
      questionImage: questionImageUrl,
    });
  } catch (err) {
    console.error("uploadImageQuestion:", err);
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/upload/bulk-image
export const bulkUpload = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({
        error: "At least one image is required",
      });
    }

    const questions = getQuestionsCollection();
    const results = [];
    const limit = pLimit(5);

    await Promise.all(
      files.map((file) =>
        limit(async () => {
          const id = `bulk_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 6)}`;

          const compressed = await sharp(file.buffer)
            .resize({ width: 1400, withoutEnlargement: true })
            .webp({ quality: 90 })
            .toBuffer();

          const key = `${QUESTION_PREFIX}/${id}/question.webp`;

          await uploadToB2({
            key,
            body: compressed,
            contentType: "image/webp",
          });

          const imageUrl = buildImageUrl(key);
          const doc = {
            id,
            questionType: "image_mcq",
            topic: "visual_reasoning",
            questionImage: imageUrl,
            questionImageKey: key,
            optionRegions: {},
            correctLetter: "a",
            createdAt: new Date().toISOString(),
          };

          await questions.insertOne(doc);
          results.push({ id, imageUrl });
        })
      )
    );

    return res.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (err) {
    console.error("bulkUpload:", err);
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/upload/solution-image
export const uploadSolutionImage = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Solution image required" });
    }

    const id = `solution_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const compressed = await sharp(file.buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();

    const key = `${SOLUTION_PREFIX}/${id}/solution.webp`;

    await uploadToB2({
      key,
      body: compressed,
      contentType: "image/webp",
    });

    const url = buildImageUrl(key);
    return res.json({ url, key });
  } catch (err) {
    console.error("uploadSolutionImage:", err);
    return res.status(500).json({ error: err.message });
  }
};
