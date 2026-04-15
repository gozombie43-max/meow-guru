// routes/massUploadImages.js
// POST /api/mass-upload-images
// Expects: multipart/form-data with fields:
//   - zipFile: the ZIP file
//   - subjectId, topicId, quizId: target identifiers
//   - subjectName, topicName, quizName: display names (optional, for Cosmos doc)

import express from "express";
import multer from "multer";
import JSZip from "jszip";
import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import { getQuestionsContainer } from "../containerStore.js"; // ✅ use shared container

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB

// ── Azure Blob client (init once) ──────────────────────────────────────────
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_QUESTIONS // ✅ correct env var name
);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Upload a Buffer to Azure Blob Storage and return the CDN URL.
 * Path: questions/{questionId}/question.webp
 */
async function uploadToAzure(buffer, questionId) {
  const blobName = `questions/${questionId}/question.webp`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "image/webp" },
  });
  const cdnBase = process.env.AZURE_CDN_URL.replace(/\/$/, "");
  return `${cdnBase}/${blobName}`;
}

/**
 * Convert any image buffer → WebP buffer using sharp.
 */
async function toWebP(buffer) {
  return sharp(buffer).webp({ quality: 85 }).toBuffer();
}

/**
 * Save a question document to Cosmos DB using the shared container.
 */
async function saveToCosmosDB(doc) {
  const container = getQuestionsContainer(); // ✅ get at call time (already initialized)
  const { resource } = await container.items.create(doc);
  return resource;
}

/**
 * Validate a single metadata entry.
 * Returns an array of error strings (empty = valid).
 */
function validateEntry(entry, index) {
  const errors = [];
  if (!entry.filename) errors.push(`[${index}] missing "filename"`);
  if (!entry.correctAnswer || !["A", "B", "C", "D"].includes(entry.correctAnswer))
    errors.push(`[${index}] "correctAnswer" must be A, B, C, or D`);
  if (!entry.options || typeof entry.options !== "object")
    errors.push(`[${index}] missing "options" object`);
  else {
    for (const opt of ["A", "B", "C", "D"]) {
      const o = entry.options[opt];
      if (!o) { errors.push(`[${index}] missing option "${opt}"`); continue; }
      for (const field of ["x", "y", "w", "h"]) {
        if (typeof o[field] !== "number" || o[field] < 0 || o[field] > 1)
          errors.push(`[${index}] option "${opt}.${field}" must be a number 0–1`);
      }
    }
  }
  return errors;
}

// ── Route ──────────────────────────────────────────────────────────────────

router.post(
  "/mass-upload-images",
  upload.single("zipFile"),
  async (req, res) => {
    // 1. Basic validation
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No ZIP file provided." });
    }
    const { subjectId, topicId, quizId, subjectName, topicName, quizName } = req.body;
    if (!subjectId || !topicId || !quizId) {
      return res
        .status(400)
        .json({ success: false, error: "subjectId, topicId, and quizId are required." });
    }

    // 2. Parse ZIP
    let zip;
    try {
      zip = await JSZip.loadAsync(req.file.buffer);
    } catch {
      return res.status(400).json({ success: false, error: "Could not parse ZIP file." });
    }

    // 3. Read metadata.json
    const metaFile = zip.file("metadata.json");
    if (!metaFile) {
      return res
        .status(400)
        .json({ success: false, error: 'ZIP must contain a "metadata.json" at its root.' });
    }
    let metadata;
    try {
      const raw = await metaFile.async("string");
      metadata = JSON.parse(raw);
      if (!Array.isArray(metadata)) throw new Error("metadata.json must be a JSON array.");
    } catch (e) {
      return res.status(400).json({ success: false, error: `metadata.json parse error: ${e.message}` });
    }

    // 4. Validate all entries upfront → return all errors at once
    const allErrors = metadata.flatMap((entry, i) => validateEntry(entry, i));
    if (allErrors.length > 0) {
      return res.status(400).json({ success: false, errors: allErrors });
    }

    // 5. Process each entry
    const results = [];
    const errors = [];

    for (let i = 0; i < metadata.length; i++) {
      const entry = metadata[i];
      const { filename, correctAnswer, options, explanation = "" } = entry;

      try {
        // Find image in ZIP (search root and one level of subdirectories)
        const imageFile =
          zip.file(filename) ||
          zip.file(`images/${filename}`) ||
          Object.values(zip.files).find((f) => f.name.endsWith(`/${filename}`) || f.name === filename);

        if (!imageFile) {
          errors.push({ filename, error: `Image file "${filename}" not found in ZIP.` });
          continue;
        }

        // Convert to WebP
        const rawBuffer = await imageFile.async("nodebuffer");
        const webpBuffer = await toWebP(rawBuffer);

        // Generate unique questionId matching your existing pattern
        const questionId = `visual_${Date.now()}_${uuidv4().slice(0, 8)}`;

        // Upload to Azure Blob
        const questionImage = await uploadToAzure(webpBuffer, questionId);

        // Build Cosmos DB document (matches your existing schema)
        const doc = {
          id: questionId,
          questionId,
          type: "visual",
          subjectId,
          topicId,
          quizId,
          subjectName: subjectName || subjectId,
          topicName: topicName || topicId,
          quizName: quizName || quizId,
          questionImage,
          correctAnswer,
          options, // percentage-based bounding boxes
          explanation,
          createdAt: new Date().toISOString(),
          source: "mass-upload",
        };

        await saveToCosmosDB(doc);

        results.push({ filename, questionId, questionImage });
      } catch (err) {
        errors.push({ filename, error: err.message });
      }
    }

    // 6. Respond with summary
    return res.status(errors.length > 0 && results.length === 0 ? 500 : 200).json({
      success: results.length > 0,
      uploaded: results.length,
      failed: errors.length,
      results,
      errors,
    });
  }
);

export default router;