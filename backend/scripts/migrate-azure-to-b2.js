import 'dotenv/config';

import { BlobServiceClient } from '@azure/storage-blob';

import {
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

import {
  b2Client,
  B2_BUCKET,
} from '../config/b2.js';

const azureConnectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!azureConnectionString) {
  throw new Error(
    'AZURE_STORAGE_CONNECTION_STRING is missing'
  );
}

const blobServiceClient =
  BlobServiceClient.fromConnectionString(
    azureConnectionString
  );

const mappings = [
  {
    label: 'Question Images',
    azureContainer:
      process.env.AZURE_STORAGE_CONTAINER_QUESTIONS,
    b2Prefix: 'question-images',
  },
  {
    label: 'Solution Images',
    azureContainer:
      process.env.AZURE_STORAGE_CONTAINER_SOLUTIONS,
    b2Prefix: 'solution-images',
  },
  {
    label: 'Notes',
    azureContainer:
      process.env.AZURE_STORAGE_CONTAINER_NOTES,
    b2Prefix: 'notes',
  },
  {
    label: 'Quiz PDFs',
    azureContainer:
      process.env.AZURE_STORAGE_CONTAINER_QUIZ_PDFS,
    b2Prefix: 'quiz-pdfs',
  },
  {
    label: 'All PDFs',
    azureContainer:
      process.env.AZURE_STORAGE_CONTAINER_ALL_PDFS,
    b2Prefix: 'all-pdfs',
  },
].filter(
  (item) =>
    item.azureContainer &&
    String(item.azureContainer).trim()
);

async function alreadyExists(
  key,
  expectedSize
) {
  try {
    const result = await b2Client.send(
      new HeadObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
      })
    );

    return (
      Number(result.ContentLength) ===
      Number(expectedSize)
    );
  } catch (error) {
    const status =
      error?.$metadata?.httpStatusCode;

    if (
      status === 404 ||
      error?.name === 'NotFound'
    ) {
      return false;
    }

    throw error;
  }
}

async function migrateContainer(mapping) {
  const container =
    blobServiceClient.getContainerClient(
      mapping.azureContainer
    );

  let processed = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let bytesUploaded = 0;

  console.log('');
  console.log(
    `===== ${mapping.label} =====`
  );

  for await (
    const blob of container.listBlobsFlat()
  ) {
    processed++;

    const sourceSize =
      blob.properties.contentLength || 0;

    const key =
      `${mapping.b2Prefix}/${blob.name}`;

    try {
      if (
        await alreadyExists(
          key,
          sourceSize
        )
      ) {
        skipped++;

        console.log(
          `⏭️  ${key}`
        );

        continue;
      }

      const blobClient =
        container.getBlobClient(
          blob.name
        );

      const download =
        await blobClient.download(0);

      await b2Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,

          Body:
            download.readableStreamBody,

          ContentLength:
            sourceSize,

          ContentType:
            blob.properties.contentType ||
            'application/octet-stream',

          ...(blob.properties.cacheControl
            ? {
                CacheControl:
                  blob.properties
                    .cacheControl,
              }
            : {}),

          ...(blob.properties
            .contentDisposition
            ? {
                ContentDisposition:
                  blob.properties
                    .contentDisposition,
              }
            : {}),
        })
      );

      uploaded++;
      bytesUploaded += sourceSize;

      console.log(
        `✅ ${key}`
      );

    } catch (error) {
      failed++;

      console.error(
        `❌ ${key}`
      );

      console.error(
        error.message
      );
    }
  }

  return {
    label: mapping.label,
    processed,
    uploaded,
    skipped,
    failed,
    bytesUploaded,
  };
}

async function run() {
  const results = [];

  console.log(
    'Starting Azure Blob → Backblaze B2 migration'
  );

  console.log(
    'Azure files will NOT be deleted.'
  );

  for (const mapping of mappings) {
    results.push(
      await migrateContainer(mapping)
    );
  }

  console.log('');
  console.log(
    '======================================'
  );
  console.log(
    'MIGRATION RESULTS'
  );
  console.log(
    '======================================'
  );

  for (const result of results) {
    console.log('');
    console.log(result.label);
    console.log(
      `Processed : ${result.processed}`
    );
    console.log(
      `Uploaded  : ${result.uploaded}`
    );
    console.log(
      `Skipped   : ${result.skipped}`
    );
    console.log(
      `Failed    : ${result.failed}`
    );
  }

  const totalProcessed =
    results.reduce(
      (sum, r) =>
        sum + r.processed,
      0
    );

  const totalUploaded =
    results.reduce(
      (sum, r) =>
        sum + r.uploaded,
      0
    );

  const totalSkipped =
    results.reduce(
      (sum, r) =>
        sum + r.skipped,
      0
    );

  const totalFailed =
    results.reduce(
      (sum, r) =>
        sum + r.failed,
      0
    );

  console.log('');
  console.log(
    '--------------------------------------'
  );
  console.log(
    `Total processed : ${totalProcessed}`
  );
  console.log(
    `Total uploaded  : ${totalUploaded}`
  );
  console.log(
    `Total skipped   : ${totalSkipped}`
  );
  console.log(
    `Total failed    : ${totalFailed}`
  );
  console.log(
    '======================================'
  );

  if (totalFailed === 0) {
    console.log(
      '✅ COPY COMPLETE'
    );
  } else {
    console.log(
      '⚠️ Some files failed. Safe to rerun.'
    );
  }
}

run().catch((error) => {
  console.error(
    '❌ Migration failed'
  );

  console.error(error);

  process.exit(1);
});