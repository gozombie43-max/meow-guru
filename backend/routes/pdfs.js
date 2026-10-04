import { invalidatePdfCache, listTopicPdfs } from './../services/documents/pdfCatalogService.js';
import { normalizeTopic, normalizeCategory, titleFromBlobPath, getContentType, isAllowedDocument, getPdfId, getBlobPathFromPdfId, isDocumentBlob, getB2Key, getPdfPath } from './../services/documents/pdfDocumentModel.js';
import { runtimeLog } from '../infrastructure/runtimeLog.js';
// backend/routes/pdfs.js

import express from 'express';

import multer from 'multer';

import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { b2Client, B2_BUCKET } from '../config/b2.js';

import adminAuth from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

// ───────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────

/*
 * IMPORTANT:
 *
 * Keep IDs based on the old logical blobPath,
 * NOT on the new "quiz-pdfs/" B2 prefix.
 *
 * This preserves compatibility with your
 * existing frontend/bookmarks/URLs.
 */

/*
 * Azure path:
 *
 * percentages/notes/file.pdf
 *
 * B2 path:
 *
 * quiz-pdfs/percentages/notes/file.pdf
 */

/*
 * Remove the B2 root prefix and return
 * the old logical Azure-style path.
 */

// ───────────────────────────────────────────────────────
// B2 listing helper
// ───────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────
// GET /api/pdfs
// ───────────────────────────────────────────────────────

router.get(
  '/',
  async (req, res) => {
    try {
      const topic =
        normalizeTopic(
          req.query.topic
        );

      const category =
        normalizeCategory(
          req.query.category
        );

      if (!topic) {
        return res
          .status(400)
          .json({
            error:
              'topic is required',
          });
      }

      const pdfs =
        await listTopicPdfs(
          topic,
          category
        );

      return res.json({
        success: true,
        topic,
        category,
        pdfs,
      });

    } catch (err) {
      runtimeLog.error(
        'GET /api/pdfs error:',
        err
      );

      return res
        .status(500)
        .json({
          error:
            err.message ||
            'Failed to fetch PDFs',
        });
    }
  }
);

// ───────────────────────────────────────────────────────
// POST /api/pdfs
// ───────────────────────────────────────────────────────

router.post(
  '/',

  adminAuth,

  upload.fields([
    {
      name: 'files',
      maxCount: 20,
    },
    {
      name: 'pdfs',
      maxCount: 20,
    },
    {
      name: 'pdf',
      maxCount: 20,
    },
  ]),

  async (req, res) => {
    try {
      const topic =
        normalizeTopic(
          req.body.topic
        );

      const category =
        normalizeCategory(
          req.body.category
        );

      if (!topic) {
        return res
          .status(400)
          .json({
            error:
              'topic is required',
          });
      }

      const files = [
        ...(req.files?.files || []),
        ...(req.files?.pdfs || []),
        ...(req.files?.pdf || []),
      ];

      if (!files.length) {
        return res
          .status(400)
          .json({
            error:
              'At least one PDF, HTML, DOC, or DOCX file is required',
          });
      }

      const invalidFile =
        files.find(
          (file) =>
            !isAllowedDocument(
              file
            )
        );

      if (invalidFile) {
        return res
          .status(400)
          .json({
            error:
              'Only PDF, HTML, DOC, and DOCX files are allowed',
          });
      }

      const pdfs = [];

      for (const file of files) {
        const blobPath =
          getPdfPath(
            topic,
            category,
            file.originalname
          );

        const key =
          getB2Key(
            blobPath
          );

        await b2Client.send(
          new PutObjectCommand({
            Bucket:
              B2_BUCKET,

            Key:
              key,

            Body:
              file.buffer,

            ContentLength:
              file.size,

            ContentType:
              getContentType(
                file.originalname,
                file.mimetype
              ),

            CacheControl:
              'no-cache',

            Metadata: {
              topic:
                String(topic),

              category:
                String(category),

              originalname:
                encodeURIComponent(
                  file.originalname
                ),
            },
          })
        );

        pdfs.push({
          id:
            getPdfId(
              blobPath
            ),

          title:
            titleFromBlobPath(
              blobPath
            ),

          topic,

          category,

          blobPath,

          fileName:
            blobPath
              .split('/')
              .pop() ||
            blobPath,

          size:
            file.size,

          uploadedAt:
            new Date()
              .toISOString(),

          streamUrl:
            `/api/pdfs/stream/${getPdfId(
              blobPath
            )}`,
        });
      }

      await invalidatePdfCache(topic);

      return res
        .status(201)
        .json({
          success: true,
          pdf: pdfs[0],
          pdfs,
        });

    } catch (err) {
      runtimeLog.error(
        'POST /api/pdfs error:',
        err
      );

      return res
        .status(500)
        .json({
          error:
            err.message ||
            'Failed to upload files',
        });
    }
  }
);

// ───────────────────────────────────────────────────────
// GET /api/pdfs/stream/:id
// ───────────────────────────────────────────────────────

router.get(
  '/stream/:id',

  async (req, res) => {
    try {
      const blobPath =
        getBlobPathFromPdfId(
          req.params.id
        );

      if (
        !blobPath ||
        !isDocumentBlob(
          blobPath
        )
      ) {
        return res
          .status(404)
          .json({
            error:
              'File not found',
          });
      }

      const key =
        getB2Key(
          blobPath
        );

      /*
       * Equivalent of your previous
       * 2-hour Azure SAS URL.
       */
      const url =
        await getSignedUrl(
          b2Client,

          new GetObjectCommand({
            Bucket:
              B2_BUCKET,

            Key:
              key,
          }),

          {
            expiresIn:
              2 * 60 * 60,
          }
        );

      return res.json({
        url,
      });

    } catch (err) {
      runtimeLog.error(
        'GET /api/pdfs/stream error:',
        err
      );

      return res
        .status(500)
        .json({
          error:
            err.message ||
            'Failed to open PDF',
        });
    }
  }
);

export default router;

export { invalidatePdfCache } from '../services/documents/pdfCatalogService.js';
