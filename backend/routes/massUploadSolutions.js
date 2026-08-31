// routes/massUploadSolutions.js
// POST /api/mass-upload-solutions

import express from "express";
import multer from "multer";
import JSZip from "jszip";
import sharp from "sharp";

import {
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

import {
  getQuestionsCollection,
} from "../config/mongodb.js";

import adminAuth from "../middleware/auth.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

const SOLUTION_PREFIX = "solution-images";

const IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";


// ───────────────────────────────────────────────────────
// Image URL helpers
// ───────────────────────────────────────────────────────

const imageIdFromKey = (key) =>
  Buffer
    .from(key, "utf8")
    .toString("base64url");

const buildImageUrl = (key) =>
  `/api/upload/image/${imageIdFromKey(key)}`;


// ───────────────────────────────────────────────────────
// Image conversion
// ───────────────────────────────────────────────────────

async function toWebP(buffer) {
  return sharp(buffer)
    .webp({
      quality: 85,
    })
    .toBuffer();
}


// ───────────────────────────────────────────────────────
// B2 upload
// ───────────────────────────────────────────────────────

async function uploadSolutionToB2(
  buffer,
  questionId
) {
  const key =
    `${SOLUTION_PREFIX}/${questionId}/solution.webp`;

  await b2Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,

      Body: buffer,
      ContentLength: buffer.length,

      ContentType: "image/webp",

      CacheControl:
        IMAGE_CACHE_CONTROL,
    })
  );

  return {
    key,
    url: buildImageUrl(key),
  };
}


// ───────────────────────────────────────────────────────
// Solution markdown
// ───────────────────────────────────────────────────────

function mergeSolutionContent(
  existingSolution,
  solutionImage
) {
  const imageMarkdown =
    `![solution](${solutionImage})`;

  const textOnly = String(
    existingSolution || ""
  )
    .replace(
      /\s*!\[[^\]]*\]\([^)]+\)\s*/g,
      "\n\n"
    )
    .trim();

  if (!textOnly) {
    return imageMarkdown;
  }

  return (
    `${textOnly}\n\n${imageMarkdown}`
  );
}


// ───────────────────────────────────────────────────────
// MongoDB patch
// ───────────────────────────────────────────────────────

async function patchSolutionImage(
  questionId,
  solutionImage,
  solutionImageKey
) {
  const questions =
    getQuestionsCollection();

  const doc =
    await questions.findOne({
      id: questionId,
    });

  if (!doc) {
    throw new Error(
      `Question "${questionId}" not found in MongoDB`
    );
  }

  const solution =
    mergeSolutionContent(
      doc.solution,
      solutionImage
    );

  await questions.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        solutionImage,
        solutionImageKey,
        solution,

        updatedAt:
          new Date()
            .toISOString(),
      },
    }
  );

  return {
    ...doc,
    solutionImage,
    solutionImageKey,
    solution,
  };
}


// ───────────────────────────────────────────────────────
// Filename helpers
// ───────────────────────────────────────────────────────

function stemOf(filename) {
  return String(filename).replace(
    /\.[^/.]+$/,
    ""
  );
}

const IMAGE_EXTENSIONS =
  new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".bmp",
  ]);

function isImage(filename) {
  const dotIndex =
    String(filename).lastIndexOf(".");

  if (dotIndex === -1) {
    return false;
  }

  const extension =
    String(filename)
      .slice(dotIndex)
      .toLowerCase();

  return IMAGE_EXTENSIONS.has(
    extension
  );
}

function findImageInZip(
  zip,
  filename
) {
  return (
    zip.file(filename) ||
    zip.file(`images/${filename}`) ||
    Object.values(
      zip.files
    ).find(
      (file) =>
        file.name.endsWith(
          `/${filename}`
        ) ||
        file.name === filename
    )
  );
}


// ======================================================
// POST /api/mass-upload-solutions
// ======================================================

router.post(
  "/mass-upload-solutions",

  adminAuth,

  upload.single("zipFile"),

  async (req, res) => {

    // ── Validate ZIP ───────────────────────────────────

    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "No ZIP file provided.",
        });
    }


    // ── Parse ZIP ──────────────────────────────────────

    let zip;

    try {
      zip =
        await JSZip.loadAsync(
          req.file.buffer
        );

    } catch {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "Could not parse ZIP file.",
        });
    }


    // ── filename → questionId map ─────────────────────

    const filenameToQuestionId =
      new Map();

    const metaFile =
      zip.file(
        "metadata.json"
      );


    // Mode A:
    // metadata.json explicitly maps files to questions

    if (metaFile) {
      let metadata;

      try {
        const raw =
          await metaFile.async(
            "string"
          );

        metadata =
          JSON.parse(raw);

        if (
          !Array.isArray(metadata)
        ) {
          throw new Error(
            "metadata.json must be a JSON array."
          );
        }

      } catch (error) {
        return res
          .status(400)
          .json({
            success: false,
            error:
              `metadata.json parse error: ${error.message}`,
          });
      }

      const metaErrors = [];

      metadata.forEach(
        (entry, index) => {

          if (!entry.filename) {
            metaErrors.push(
              `[${index}] missing "filename"`
            );
          }

          if (!entry.questionId) {
            metaErrors.push(
              `[${index}] missing "questionId"`
            );
          }
        }
      );

      if (
        metaErrors.length > 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            errors:
              metaErrors,
          });
      }

      for (
        const entry
        of metadata
      ) {
        filenameToQuestionId.set(
          entry.filename,
          entry.questionId
        );
      }


    // Mode B:
    // filename itself is the question id

    } else {

      for (
        const [
          name,
          file,
        ]
        of Object.entries(
          zip.files
        )
      ) {
        if (file.dir) {
          continue;
        }

        const basename =
          name
            .split("/")
            .pop();

        if (
          !basename ||
          !isImage(
            basename
          )
        ) {
          continue;
        }

        filenameToQuestionId.set(
          basename,
          stemOf(
            basename
          )
        );
      }
    }


    if (
      filenameToQuestionId.size ===
      0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "No valid image entries found in ZIP.",
        });
    }


    // ── Process solution images ────────────────────────

    const results = [];
    const errors = [];

    for (
      const [
        filename,
        questionId,
      ]
      of filenameToQuestionId
    ) {
      try {

        // Confirm question exists BEFORE uploading

        const questions =
          getQuestionsCollection();

        const existing =
          await questions.findOne({
            id: questionId,
          });

        if (!existing) {
          errors.push({
            filename,
            questionId,
            error:
              `Question "${questionId}" not found in MongoDB`,
          });

          continue;
        }


        // Find image inside ZIP

        const imageFile =
          findImageInZip(
            zip,
            filename
          );

        if (!imageFile) {
          errors.push({
            filename,
            questionId,
            error:
              `Image "${filename}" not found in ZIP.`,
          });

          continue;
        }


        // Convert to WebP

        const rawBuffer =
          await imageFile.async(
            "nodebuffer"
          );

        const webpBuffer =
          await toWebP(
            rawBuffer
          );


        // Upload to Backblaze B2

        const {
          key,
          url,
        } =
          await uploadSolutionToB2(
            webpBuffer,
            questionId
          );


        // Patch MongoDB question

        await patchSolutionImage(
          questionId,
          url,
          key
        );


        results.push({
          filename,
          questionId,

          solutionImage:
            url,

          solutionImageKey:
            key,
        });

      } catch (error) {

        errors.push({
          filename,
          questionId,
          error:
            error.message,
        });
      }
    }


    // ── Response ───────────────────────────────────────

    return res
      .status(
        errors.length > 0 &&
        results.length === 0
          ? 500
          : 200
      )
      .json({
        success:
          results.length > 0,

        uploaded:
          results.length,

        failed:
          errors.length,

        results,

        errors,
      });
  }
);

export default router;