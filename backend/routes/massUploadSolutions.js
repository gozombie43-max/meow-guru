// routes/massUploadSolutions.js
// POST /api/mass-upload-solutions
// Expects: multipart/form-data with fields:
//   - zipFile: the ZIP file
//
// ZIP can contain either:
//   A) Images named exactly {questionId}.png/.jpg/.webp (auto-match by filename stem)
//   B) A metadata.json array: [{ "filename": "q1.png", "questionId": "abc123" }, ...]
//
// Each matched question doc in Cosmos gets patched with:
//   solutionImage: "https://.../solutions/{questionId}/solution.webp"

import express from "express";
import multer from "multer";
import JSZip from "jszip";
import { BlobServiceClient } from "@azure/storage-blob";
import sharp from "sharp";
import { getQuestionsContainer } from "../containerStore.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ── Azure Blob client ──────────────────────────────────────────────────────
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_QUESTIONS
);

// ── Helpers ────────────────────────────────────────────────────────────────

async function toWebP(buffer) {
  return sharp(buffer).webp({ quality: 85 }).toBuffer();
}

async function uploadSolutionToAzure(buffer, questionId) {
  const blobName = `solutions/${questionId}/solution.webp`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: "image/webp" },
  });
  const cdnBase = process.env.AZURE_CDN_URL.replace(/\/$/, "");
  return `${cdnBase}/${containerClient.containerName}/${blobName}`;
}

function mergeSolutionContent(existingSolution, solutionImage) {
  const imageMarkdown = `![solution](${solutionImage})`;
  const textOnly = String(existingSolution || "")
    .replace(/\s*!\[[^\]]*\]\([^)]+\)\s*/g, "\n\n")
    .trim();

  if (!textOnly) return imageMarkdown;
  return `${textOnly}\n\n${imageMarkdown}`;
}

/**
 * Patch the Cosmos document for questionId with solutionImage URL.
 * Uses replace operation — reads the doc first, then replaces it.
 */
async function patchSolutionImage(questionId, solutionImage) {
  const container = getQuestionsContainer();

  // First fetch the doc to get its partition key value (/topic)
  const querySpec = {
    query: "SELECT * FROM c WHERE c.id = @id",
    parameters: [{ name: "@id", value: questionId }],
  };
  const { resources } = await container.items.query(querySpec).fetchAll();

  if (!resources || resources.length === 0) {
    throw new Error(`Question "${questionId}" not found in Cosmos DB`);
  }

  const doc = resources[0];
  const updatedDoc = {
    ...doc,
    solutionImage,
    solution: mergeSolutionContent(doc.solution, solutionImage),
  };

  await container.items.upsert(updatedDoc);
  return updatedDoc;
}

/**
 * Extract filename stem (no extension).
 * e.g. "abc123.png" → "abc123"
 */
function stemOf(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);

function isImage(filename) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

// ── Route ──────────────────────────────────────────────────────────────────

router.post(
  "/mass-upload-solutions",
  upload.single("zipFile"),
  async (req, res) => {
    // 1. Validate zip
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No ZIP file provided." });
    }

    // 2. Parse ZIP
    let zip;
    try {
      zip = await JSZip.loadAsync(req.file.buffer);
    } catch {
      return res.status(400).json({ success: false, error: "Could not parse ZIP file." });
    }

    // 3. Build filename → questionId map
    // Mode A: metadata.json present → use it
    // Mode B: no metadata.json → use filename stem as questionId
    const filenameToQuestionId = new Map();
    const metaFile = zip.file("metadata.json");

    if (metaFile) {
      // Mode A — metadata.json
      let metadata;
      try {
        const raw = await metaFile.async("string");
        metadata = JSON.parse(raw);
        if (!Array.isArray(metadata)) throw new Error("metadata.json must be a JSON array.");
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: `metadata.json parse error: ${e.message}`,
        });
      }

      const metaErrors = [];
      metadata.forEach((entry, i) => {
        if (!entry.filename) metaErrors.push(`[${i}] missing "filename"`);
        if (!entry.questionId) metaErrors.push(`[${i}] missing "questionId"`);
      });
      if (metaErrors.length > 0) {
        return res.status(400).json({ success: false, errors: metaErrors });
      }

      for (const entry of metadata) {
        filenameToQuestionId.set(entry.filename, entry.questionId);
      }
    } else {
      // Mode B — filename stem = questionId
      for (const [name, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        const basename = name.split("/").pop();
        if (!basename || !isImage(basename)) continue;
        const qid = stemOf(basename);
        filenameToQuestionId.set(basename, qid);
      }
    }

    if (filenameToQuestionId.size === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid image entries found in ZIP.",
      });
    }

    // 4. Process each entry
    const results = [];
    const errors = [];

    for (const [filename, questionId] of filenameToQuestionId) {
      try {
        // Find image in ZIP
        const imageFile =
          zip.file(filename) ||
          zip.file(`images/${filename}`) ||
          Object.values(zip.files).find(
            (f) => f.name.endsWith(`/${filename}`) || f.name === filename
          );

        if (!imageFile) {
          errors.push({ filename, questionId, error: `Image "${filename}" not found in ZIP.` });
          continue;
        }

        // Convert to WebP
        const rawBuffer = await imageFile.async("nodebuffer");
        const webpBuffer = await toWebP(rawBuffer);

        // Upload to Azure Blob
        const solutionImage = await uploadSolutionToAzure(webpBuffer, questionId);

        // Patch Cosmos document
        await patchSolutionImage(questionId, solutionImage);

        results.push({ filename, questionId, solutionImage });
      } catch (err) {
        errors.push({ filename, questionId, error: err.message });
      }
    }

    // 5. Respond
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
