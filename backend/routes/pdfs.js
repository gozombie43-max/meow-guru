// backend/routes/pdfs.js

import express from 'express';
import multer from 'multer';

import {
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

import {
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';

import {
  b2Client,
  B2_BUCKET,
} from '../config/b2.js';

import adminAuth from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

const B2_PDF_PREFIX = String(
  process.env.B2_PDF_PREFIX || 'quiz-pdfs'
)
  .replace(/^\/+|\/+$/g, '');


// ───────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────

const nameCollator = new Intl.Collator(
  undefined,
  {
    numeric: true,
    sensitivity: 'base',
  }
);

const normalizeTopic = (topic) =>
  String(topic || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeCategory = (category) => {
  const normalized =
    normalizeTopic(category || 'notes');

  return [
    'notes',
    'formula',
    'extra',
    'dpp',
  ].includes(normalized)
    ? normalized
    : 'notes';
};

const titleFromBlobPath = (blobPath) =>
  (
    blobPath.split('/').pop() ||
    blobPath
  )
    .replace(/\.(pdf|html?|docx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(
      /\b\w/g,
      (letter) => letter.toUpperCase()
    );

const allowedExtensions = new Set([
  '.pdf',
  '.html',
  '.htm',
  '.doc',
  '.docx',
]);

const getFileExtension = (
  fileName = ''
) => {
  const match = String(fileName)
    .toLowerCase()
    .match(/\.[a-z0-9]+$/);

  return match ? match[0] : '';
};

const getContentType = (
  fileName = '',
  mimeType = ''
) => {
  const extension =
    getFileExtension(fileName);

  if (extension === '.pdf') {
    return 'application/pdf';
  }

  if (
    extension === '.html' ||
    extension === '.htm'
  ) {
    return 'text/html; charset=utf-8';
  }

  if (extension === '.doc') {
    return 'application/msword';
  }

  if (extension === '.docx') {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return (
    mimeType ||
    'application/octet-stream'
  );
};

const isAllowedDocument = (file) => {
  const extension =
    getFileExtension(
      file?.originalname
    );

  return allowedExtensions.has(
    extension
  );
};

const getSafeFileName = (
  fileName
) => {
  const baseName = String(
    fileName || 'document.pdf'
  )
    .split(/[\\/]/)
    .pop()
    .trim()
    .replace(
      /[<>:"|?*\x00-\x1F]/g,
      ''
    )
    .replace(/\s+/g, ' ');

  const resolvedName =
    baseName || 'document.pdf';

  const extension =
    getFileExtension(
      resolvedName
    );

  return allowedExtensions.has(
    extension
  )
    ? resolvedName
    : `${resolvedName}.pdf`;
};


/*
 * IMPORTANT:
 *
 * Keep IDs based on the old logical blobPath,
 * NOT on the new "quiz-pdfs/" B2 prefix.
 *
 * This preserves compatibility with your
 * existing frontend/bookmarks/URLs.
 */
const getPdfId = (blobPath) =>
  `pdf-${Buffer
    .from(blobPath, 'utf8')
    .toString('base64url')}`;

const getBlobPathFromPdfId = (
  id
) => {
  if (!id?.startsWith('pdf-')) {
    return null;
  }

  try {
    return Buffer
      .from(
        id.slice(4),
        'base64url'
      )
      .toString('utf8');
  } catch {
    return null;
  }
};

const isDocumentBlob = (
  blobPath
) =>
  allowedExtensions.has(
    getFileExtension(blobPath)
  );


/*
 * Azure path:
 *
 * percentages/notes/file.pdf
 *
 * B2 path:
 *
 * quiz-pdfs/percentages/notes/file.pdf
 */
const getB2Key = (blobPath) =>
  `${B2_PDF_PREFIX}/${blobPath}`;


/*
 * Remove the B2 root prefix and return
 * the old logical Azure-style path.
 */
const getLogicalPath = (key) => {
  const prefix =
    `${B2_PDF_PREFIX}/`;

  if (
    !String(key).startsWith(
      prefix
    )
  ) {
    return key;
  }

  return String(key).slice(
    prefix.length
  );
};


const getPdfPath = (
  topic,
  category = 'notes',
  fileName
) => {
  const normalizedCategory =
    normalizeCategory(category);

  return (
    `${topic}/` +
    `${normalizedCategory}/` +
    `${getSafeFileName(fileName)}`
  );
};


// ───────────────────────────────────────────────────────
// B2 listing helper
// ───────────────────────────────────────────────────────

async function listObjectsByPrefix(
  prefix
) {
  const objects = [];

  let continuationToken;

  do {
    const response =
      await b2Client.send(
        new ListObjectsV2Command({
          Bucket: B2_BUCKET,
          Prefix: prefix,
          ContinuationToken:
            continuationToken,
          MaxKeys: 1000,
        })
      );

    objects.push(
      ...(response.Contents || [])
    );

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;

  } while (continuationToken);

  return objects;
}


const topicPdfsCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

export const invalidatePdfCache = (topic) => {
  if (!topic) {
    topicPdfsCache.clear();
    return;
  }
  const prefix = `${normalizeTopic(topic)}:`;
  for (const key of topicPdfsCache.keys()) {
    if (key.startsWith(prefix)) {
      topicPdfsCache.delete(key);
    }
  }
};

// ───────────────────────────────────────────────────────
// List topic PDFs
// ───────────────────────────────────────────────────────

const listTopicPdfs = async (
  topic,
  category = 'notes'
) => {
  const normalizedCategory =
    normalizeCategory(category);

  const cacheKey = `${topic}:${normalizedCategory}`;
  const cached = topicPdfsCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.pdfs;
  }

  /*
   * Preserve your existing Azure behaviour:
   *
   * notes:
   *   topic/notes/
   *   topic/
   *
   * other:
   *   topic/formula/
   *   topic/extra/
   *   topic/dpp/
   */
  const logicalPrefixes =
    normalizedCategory === 'notes'
      ? [
          `${topic}/notes/`,
          `${topic}/`,
        ]
      : [
          `${topic}/${normalizedCategory}/`,
        ];

  const pdfs = [];
  const seen = new Set();

  const prefixResults = await Promise.all(
    logicalPrefixes.map(async (logicalPrefix) => {
      const b2Prefix = getB2Key(logicalPrefix);
      return listObjectsByPrefix(b2Prefix);
    })
  );

  const objects = prefixResults.flat();

  for (const object of objects) {
      if (!object.Key) continue;

      const blobPath =
        getLogicalPath(
          object.Key
        );

      if (
        !isDocumentBlob(
          blobPath
        ) ||
        seen.has(blobPath)
      ) {
        continue;
      }

      /*
       * Preserve the special "notes"
       * filtering logic from Azure.
       */
      if (
        normalizedCategory ===
        'notes'
      ) {
        const rest =
          blobPath.slice(
            `${topic}/`.length
          );

        if (
          rest.includes('/') &&
          !rest.startsWith(
            'notes/'
          )
        ) {
          continue;
        }
      }

      seen.add(blobPath);

      const modified =
        object.LastModified
          ? new Date(
              object.LastModified
            ).toISOString()
          : '';

      pdfs.push({
        id:
          getPdfId(blobPath),

        title:
          titleFromBlobPath(
            blobPath
          ),

        topic,

        category:
          normalizedCategory,

        /*
         * Keep the property name
         * blobPath for frontend
         * compatibility.
         */
        blobPath,

        fileName:
          blobPath
            .split('/')
            .pop() ||
          blobPath,

        size:
          Number(
            object.Size || 0
          ),

        /*
         * S3 listing gives LastModified.
         * Use it for both fields.
         */
        uploadedAt:
          modified,

        updatedAt:
          modified,

        streamUrl:
          `/api/pdfs/stream/${getPdfId(
            blobPath
          )}`,
      });
    }

  const sorted = pdfs.sort(
    (a, b) =>
      nameCollator.compare(
        a.title ||
          a.fileName ||
          '',
        b.title ||
          b.fileName ||
          ''
      )
  );

  topicPdfsCache.set(cacheKey, {
    timestamp: Date.now(),
    pdfs: sorted,
  });

  return sorted;
};


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
      console.error(
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

      invalidatePdfCache(topic);

      return res
        .status(201)
        .json({
          success: true,
          pdf: pdfs[0],
          pdfs,
        });

    } catch (err) {
      console.error(
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
      console.error(
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
