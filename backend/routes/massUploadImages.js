// routes/massUploadImages.js

import express from "express";
import multer from "multer";
import JSZip from "jszip";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";
import pLimit from "p-limit";

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

const QUESTION_PREFIX = "question-images";

const IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";


// ───────────────────────────────────────────────────────
// B2 helpers
// ───────────────────────────────────────────────────────

const imageIdFromKey = (key) =>
  Buffer
    .from(key, "utf8")
    .toString("base64url");

const buildImageUrl = (key) =>
  `/api/upload/image/${imageIdFromKey(key)}`;

async function uploadQuestionImageToB2(
  buffer,
  questionId
) {
  const key =
    `${QUESTION_PREFIX}/${questionId}/question.webp`;

  await b2Client.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: "image/webp",
      CacheControl: IMAGE_CACHE_CONTROL,
    })
  );

  return {
    key,
    url: buildImageUrl(key),
  };
}


// ───────────────────────────────────────────────────────
// Image helpers
// ───────────────────────────────────────────────────────

async function toWebP(buffer) {
  return sharp(buffer)
    .webp({
      quality: 85,
    })
    .toBuffer();
}

function mergeQuestionContent(
  existingQuestion,
  questionImage
) {
  const imageMarkdown =
    `![question](${questionImage})`;

  const textOnly = String(
    existingQuestion || ""
  )
    .replace(
      /\s*!\[[^\]]*\]\([^)]+\)\s*/g,
      "\n\n"
    )
    .trim();

  if (!textOnly) {
    return imageMarkdown;
  }

  return `${textOnly}\n\n${imageMarkdown}`;
}


// ───────────────────────────────────────────────────────
// MongoDB helpers
// ───────────────────────────────────────────────────────

async function saveQuestion(doc) {
  const questions =
    getQuestionsCollection();

  await questions.insertOne(doc);

  return doc;
}

async function patchQuestionImage(
  questionId,
  questionImage,
  questionImageKey
) {
  const questions =
    getQuestionsCollection();

  const doc = await questions.findOne({
    id: questionId,
  });

  if (!doc) {
    throw new Error(
      `Question "${questionId}" not found in MongoDB`
    );
  }

  const question =
    mergeQuestionContent(
      doc.question,
      questionImage
    );

  await questions.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        questionImage,
        questionImageKey,
        question,
        updatedAt:
          new Date().toISOString(),
      },
    }
  );

  return {
    ...doc,
    questionImage,
    questionImageKey,
    question,
  };
}


// ───────────────────────────────────────────────────────
// Metadata validation
// ───────────────────────────────────────────────────────

function validateEntry(entry, index) {
  const errors = [];

  if (!entry.filename) {
    errors.push(
      `[${index}] missing "filename"`
    );
  }

  if (
    !entry.correctAnswer ||
    !["A", "B", "C", "D"].includes(
      entry.correctAnswer
    )
  ) {
    errors.push(
      `[${index}] "correctAnswer" must be A, B, C, or D`
    );
  }

  if (
    !entry.options ||
    typeof entry.options !== "object"
  ) {
    errors.push(
      `[${index}] missing "options" object`
    );
  } else {
    for (
      const opt of ["A", "B", "C", "D"]
    ) {
      const option =
        entry.options[opt];

      if (!option) {
        errors.push(
          `[${index}] missing option "${opt}"`
        );
        continue;
      }

      for (
        const field of [
          "x",
          "y",
          "w",
          "h",
        ]
      ) {
        if (
          typeof option[field] !==
            "number" ||
          option[field] < 0 ||
          option[field] > 1
        ) {
          errors.push(
            `[${index}] option "${opt}.${field}" must be a number 0–1`
          );
        }
      }
    }
  }

  return errors;
}

function stemOf(filename) {
  return filename.replace(
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
    filename.lastIndexOf(".");

  if (dotIndex === -1) {
    return false;
  }

  return IMAGE_EXTENSIONS.has(
    filename
      .slice(dotIndex)
      .toLowerCase()
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
// POST /api/mass-upload-images
//
// Creates completely new image questions.
// ======================================================

router.post(
  "/mass-upload-images",

  adminAuth,

  upload.single("zipFile"),

  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "No ZIP file provided.",
        });
    }

    const {
      subjectId,
      topicId,
      quizId,
      subjectName,
      topicName,
      quizName,
    } = req.body;

    if (
      !subjectId ||
      !topicId ||
      !quizId
    ) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            "subjectId, topicId, and quizId are required.",
        });
    }


    // ── Parse ZIP ──────────────────────────────────────

    let zip;

    try {
      zip = await JSZip.loadAsync(
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


    // ── metadata.json ─────────────────────────────────

    const metaFile =
      zip.file("metadata.json");

    if (!metaFile) {
      return res
        .status(400)
        .json({
          success: false,
          error:
            'ZIP must contain a "metadata.json" at its root.',
        });
    }

    let metadata;

    try {
      const raw =
        await metaFile.async(
          "string"
        );

      metadata =
        JSON.parse(raw);

      if (
        !Array.isArray(
          metadata
        )
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


    // ── Validate metadata ──────────────────────────────

    const allErrors =
      metadata.flatMap(
        (entry, index) =>
          validateEntry(
            entry,
            index
          )
      );

    if (
      allErrors.length > 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          errors:
            allErrors,
        });
    }


    // ── Upload ────────────────────────────────────────

    const results = [];
    const errors = [];

    const limit =
      pLimit(5);

    await Promise.all(
      metadata.map(
        (entry) =>
          limit(async () => {
            const {
              filename,
              correctAnswer,
              options,
              explanation = "",
            } = entry;

            try {
              const imageFile =
                findImageInZip(
                  zip,
                  filename
                );

              if (!imageFile) {
                errors.push({
                  filename,
                  error:
                    `Image file "${filename}" not found in ZIP.`,
                });

                return;
              }

              const rawBuffer =
                await imageFile.async(
                  "nodebuffer"
                );

              const webpBuffer =
                await toWebP(
                  rawBuffer
                );

              const questionId =
                `visual_${Date.now()}_${uuidv4().slice(
                  0,
                  8
                )}`;

              /*
               * New storage path:
               *
               * question-images/<id>/question.webp
               */
              const {
                key,
                url,
              } =
                await uploadQuestionImageToB2(
                  webpBuffer,
                  questionId
                );

              /*
               * MongoDB question document.
               *
               * Keep existing schema while adding
               * questionImageKey.
               */
              const doc = {
                id:
                  questionId,

                questionId,

                type:
                  "visual",

                subjectId,

                topicId,

                quizId,

                subjectName:
                  subjectName ||
                  subjectId,

                topicName:
                  topicName ||
                  topicId,

                quizName:
                  quizName ||
                  quizId,

                questionImage:
                  url,

                questionImageKey:
                  key,

                correctAnswer,

                options,

                explanation,

                createdAt:
                  new Date()
                    .toISOString(),

                source:
                  "mass-upload",
              };

              await saveQuestion(
                doc
              );

              results.push({
                filename,
                questionId,
                questionImage:
                  url,
                questionImageKey:
                  key,
              });

            } catch (error) {
              errors.push({
                filename,
                error:
                  error.message,
              });
            }
          })
      )
    );


    // ── Response ──────────────────────────────────────

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


// ======================================================
// POST /api/mass-upload-question-images
//
// Adds/replaces images for existing MongoDB questions.
// ======================================================

router.post(
  "/mass-upload-question-images",

  adminAuth,

  upload.single("zipFile"),

  async (req, res) => {
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


    // ── Build filename → questionId map ───────────────

    const filenameToQuestionId =
      new Map();

    const metaFile =
      zip.file(
        "metadata.json"
      );

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
          !Array.isArray(
            metadata
          )
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
          if (
            !entry.filename
          ) {
            metaErrors.push(
              `[${index}] missing "filename"`
            );
          }

          if (
            !entry.questionId
          ) {
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


    // ── Process images ─────────────────────────────────

    const results = [];
    const errors = [];

    const limit =
      pLimit(5);

    await Promise.all(
      Array
        .from(
          filenameToQuestionId.entries()
        )
        .map(
          ([
            filename,
            questionId,
          ]) =>
            limit(
              async () => {
                try {
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

                    return;
                  }

                  const rawBuffer =
                    await imageFile.async(
                      "nodebuffer"
                    );

                  const webpBuffer =
                    await toWebP(
                      rawBuffer
                    );

                  const {
                    key,
                    url,
                  } =
                    await uploadQuestionImageToB2(
                      webpBuffer,
                      questionId
                    );

                  await patchQuestionImage(
                    questionId,
                    url,
                    key
                  );

                  results.push({
                    filename,
                    questionId,
                    questionImage:
                      url,
                    questionImageKey:
                      key,
                  });

                } catch (
                  error
                ) {
                  errors.push({
                    filename,
                    questionId,
                    error:
                      error.message,
                  });
                }
              }
            )
        )
    );


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