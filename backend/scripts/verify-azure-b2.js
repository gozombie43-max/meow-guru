import 'dotenv/config';

import { BlobServiceClient } from '@azure/storage-blob';
import {
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

function formatBytes(bytes) {
  if (!bytes) return '0 B';

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
  ];

  const i = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  return `${(
    bytes /
    Math.pow(1024, i)
  ).toFixed(2)} ${units[i]}`;
}

async function verifyMapping(mapping) {
  const container =
    blobServiceClient.getContainerClient(
      mapping.azureContainer
    );

  let checked = 0;
  let missing = 0;
  let sizeMismatch = 0;

  let azureBytes = 0;
  let b2Bytes = 0;

  console.log('');
  console.log(
    `===== ${mapping.label} =====`
  );

  for await (
    const blob of container.listBlobsFlat()
  ) {
    checked++;

    const azureSize =
      Number(
        blob.properties.contentLength || 0
      );

    azureBytes += azureSize;

    const key =
      `${mapping.b2Prefix}/${blob.name}`;

    try {
      const head =
        await b2Client.send(
          new HeadObjectCommand({
            Bucket: B2_BUCKET,
            Key: key,
          })
        );

      const b2Size =
        Number(
          head.ContentLength || 0
        );

      b2Bytes += b2Size;

      if (azureSize !== b2Size) {
        sizeMismatch++;

        console.error(
          `❌ SIZE MISMATCH: ${key}`
        );

        console.error(
          `   Azure: ${azureSize}`
        );

        console.error(
          `   B2   : ${b2Size}`
        );
      }

    } catch (error) {
      missing++;

      console.error(
        `❌ MISSING: ${key}`
      );

      console.error(
        error.message
      );
    }

    if (checked % 100 === 0) {
      console.log(
        `Verified: ${checked}`
      );
    }
  }

  console.log('');
  console.log(
    `Checked       : ${checked}`
  );
  console.log(
    `Missing       : ${missing}`
  );
  console.log(
    `Size mismatch : ${sizeMismatch}`
  );
  console.log(
    `Azure bytes   : ${formatBytes(
      azureBytes
    )}`
  );
  console.log(
    `B2 bytes      : ${formatBytes(
      b2Bytes
    )}`
  );

  return {
    checked,
    missing,
    sizeMismatch,
    azureBytes,
    b2Bytes,
  };
}

async function run() {
  const results = [];

  console.log(
    'Azure Blob ↔ Backblaze B2 verification'
  );

  for (const mapping of mappings) {
    results.push(
      await verifyMapping(mapping)
    );
  }

  const checked =
    results.reduce(
      (sum, r) => sum + r.checked,
      0
    );

  const missing =
    results.reduce(
      (sum, r) => sum + r.missing,
      0
    );

  const mismatched =
    results.reduce(
      (sum, r) =>
        sum + r.sizeMismatch,
      0
    );

  const azureBytes =
    results.reduce(
      (sum, r) =>
        sum + r.azureBytes,
      0
    );

  const b2Bytes =
    results.reduce(
      (sum, r) =>
        sum + r.b2Bytes,
      0
    );

  console.log('');
  console.log(
    '======================================'
  );
  console.log(
    'VERIFICATION RESULTS'
  );
  console.log(
    '======================================'
  );

  console.log(
    `Files checked  : ${checked}`
  );

  console.log(
    `Missing        : ${missing}`
  );

  console.log(
    `Size mismatch  : ${mismatched}`
  );

  console.log(
    `Azure total    : ${formatBytes(
      azureBytes
    )}`
  );

  console.log(
    `B2 total       : ${formatBytes(
      b2Bytes
    )}`
  );

  console.log(
    '======================================'
  );

  if (
    checked === 744 &&
    missing === 0 &&
    mismatched === 0 &&
    azureBytes === b2Bytes
  ) {
    console.log(
      '✅ ALL 744 FILES VERIFIED'
    );
  } else {
    console.log(
      '❌ Verification found problems'
    );
  }
}

run().catch((error) => {
  console.error(
    '❌ Verification failed'
  );

  console.error(error);

  process.exit(1);
});