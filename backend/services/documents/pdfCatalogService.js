import { B2_PDF_PREFIX, nameCollator, normalizeCategory, titleFromBlobPath, getPdfId, isDocumentBlob, getB2Key, getLogicalPath } from './pdfDocumentModel.js';

import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getCacheRevision, advanceCacheRevision } from '../../repositories/cacheRevisionRepository.js';

import { ListObjectsV2Command } from '@aws-sdk/client-s3';

import { b2Client, B2_BUCKET } from '../../config/b2.js';

export async function listObjectsByPrefix(
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

export const topicPdfsCache = createTieredCache({ freshMs: 600000, staleMs: 660000 });

export const invalidatePdfCache = async () => {
  await advanceCacheRevision('pdf-list');
  topicPdfsCache.clear();
};

export const listTopicPdfs = async (
  topic,
  category = 'notes'
) => {
  const normalizedCategory =
    normalizeCategory(category);

  const revision = await getCacheRevision('pdf-list');
  const cacheKey = `pdf-list:v1:${B2_BUCKET}:${B2_PDF_PREFIX}:${revision}:${topic}:${normalizedCategory}`;
  return topicPdfsCache.read(cacheKey, async () => {
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

  return sorted;
  }, { allowStale: false });
};
