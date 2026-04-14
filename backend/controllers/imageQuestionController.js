import sharp from "sharp";
import { questionsContainer as blobContainer } from "../config/azure.js";
import { getQuestionsContainer } from "../containerStore.js";

// POST /api/upload/image-question
export const uploadImageQuestion = async (req, res) => {
  try {
    const file = req.files?.questionImage?.[0];
    if (!file) {
      return res.status(400).json({ error: "Question image required" });
    }

    const {
      topic, chapter, difficulty,
      correctLetter, solution, optionRegions
    } = req.body;

    const questionId = `${topic || "visual"}_${Date.now()}`;

    const compressed = await sharp(file.buffer)
      .resize({ width: 1400, withoutEnlargement: true })
      .webp({ quality: 92 })
      .toBuffer();

    const blockBlob = blobContainer.getBlockBlobClient(
      `${questionId}/question.webp`
    );

    await blockBlob.uploadData(compressed, {
      blobHTTPHeaders: { blobContentType: "image/webp" },
    });

    const questionImageUrl =
      `${process.env.AZURE_CDN_URL}/questions/${questionId}/question.webp`;

    let regions = optionRegions ? JSON.parse(optionRegions) : null;
    const defaultRegions = {
      a: { x: 0, y: 0.6, w: 0.5, h: 0.2 },
      b: { x: 0.5, y: 0.6, w: 0.5, h: 0.2 },
      c: { x: 0, y: 0.8, w: 0.5, h: 0.2 },
      d: { x: 0.5, y: 0.8, w: 0.5, h: 0.2 },
    };

    const regionKeys = regions && typeof regions === "object" && !Array.isArray(regions)
      ? Object.keys(regions)
      : [];

    if (!regions || regionKeys.length < 4) {
      regions = { ...defaultRegions, ...(regions || {}) };
    }

    const doc = {
      id: questionId,
      questionType: "image_mcq",
      topic: topic || "visual_reasoning",
      chapter: chapter || "Analogy",
      difficulty: difficulty || "medium",
      questionImage: questionImageUrl,
      optionRegions: regions,
      correctLetter,
      solution: solution || "",
      createdAt: new Date().toISOString(),
    };

    const cosmosContainer = getQuestionsContainer();
    await cosmosContainer.items.create(doc);

    res.status(201).json({
      success: true,
      questionId,
      questionImage: questionImageUrl,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/upload/bulk-image
export const bulkUpload = async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      return res.status(400).json({ error: "At least one image is required" });
    }

    const cosmosContainer = getQuestionsContainer();
    const results = [];

    for (const file of files) {
      const id = `bulk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const compressed = await sharp(file.buffer)
        .resize({ width: 1400, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer();

      const blobPath = `${id}/question.webp`;
      const blockBlob = blobContainer.getBlockBlobClient(blobPath);

      await blockBlob.uploadData(compressed, {
        blobHTTPHeaders: { blobContentType: "image/webp" },
      });

      const imageUrl = `${process.env.AZURE_STORAGE_URL}/questions/${blobPath}`;

      const doc = {
        id,
        questionType: "image_mcq",
        topic: "visual_reasoning",
        questionImage: imageUrl,
        optionRegions: {},
        correctLetter: "a",
        createdAt: new Date().toISOString(),
      };

      await cosmosContainer.items.create(doc);

      results.push({ id, imageUrl });
    }

    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};