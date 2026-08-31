import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!connectionString) {
  throw new Error(
    'AZURE_STORAGE_CONNECTION_STRING is missing'
  );
}

const blobServiceClient =
  BlobServiceClient.fromConnectionString(
    connectionString
  );

const containers = [
  {
    label: 'Question Images',
    name:
      process.env.AZURE_STORAGE_CONTAINER_QUESTIONS,
  },
  {
    label: 'Solution Images',
    name:
      process.env.AZURE_STORAGE_CONTAINER_SOLUTIONS,
  },
  {
    label: 'Notes',
    name:
      process.env.AZURE_STORAGE_CONTAINER_NOTES,
  },
  {
    label: 'Quiz PDFs',
    name:
      process.env.AZURE_STORAGE_CONTAINER_QUIZ_PDFS,
  },
  {
    label: 'All PDFs',
    name:
      process.env.AZURE_STORAGE_CONTAINER_ALL_PDFS,
  },
].filter(
  (entry) =>
    entry.name &&
    String(entry.name).trim()
);

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = [
    'B',
    'KB',
    'MB',
    'GB',
    'TB',
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(2)} ${units[index]}`;
}

async function inspectContainer({
  label,
  name,
}) {
  const containerClient =
    blobServiceClient.getContainerClient(
      name
    );

  let count = 0;
  let totalBytes = 0;

  const samples = [];

  console.log('');
  console.log(
    `Scanning ${label} (${name})...`
  );

  try {
    for await (
      const blob of
      containerClient.listBlobsFlat()
    ) {
      count++;

      totalBytes +=
        blob.properties.contentLength ||
        0;

      if (samples.length < 5) {
        samples.push({
          name: blob.name,
          size:
            blob.properties
              .contentLength || 0,
        });
      }
    }

    console.log(
      `✅ ${label}`
    );
    console.log(
      `   Container : ${name}`
    );
    console.log(
      `   Files     : ${count}`
    );
    console.log(
      `   Size      : ${formatBytes(
        totalBytes
      )}`
    );

    if (samples.length) {
      console.log(
        '   Samples:'
      );

      for (const sample of samples) {
        console.log(
          `   - ${sample.name} (${formatBytes(
            sample.size
          )})`
        );
      }
    }

    return {
      label,
      name,
      count,
      totalBytes,
    };
  } catch (error) {
    console.error(
      `❌ Failed: ${label}`
    );

    console.error(
      error.message
    );

    return {
      label,
      name,
      count: 0,
      totalBytes: 0,
      error: error.message,
    };
  }
}

async function run() {
  const results = [];

  for (const entry of containers) {
    results.push(
      await inspectContainer(entry)
    );
  }

  const totalFiles =
    results.reduce(
      (sum, item) =>
        sum + item.count,
      0
    );

  const totalBytes =
    results.reduce(
      (sum, item) =>
        sum + item.totalBytes,
      0
    );

  console.log('');
  console.log(
    '================================'
  );
  console.log(
    'AZURE BLOB INVENTORY'
  );
  console.log(
    '================================'
  );

  for (const result of results) {
    console.log(
      `${result.label.padEnd(
        18
      )}: ${String(
        result.count
      ).padStart(6)} files | ${formatBytes(
        result.totalBytes
      )}`
    );
  }

  console.log(
    '--------------------------------'
  );

  console.log(
    `TOTAL FILES       : ${totalFiles}`
  );

  console.log(
    `TOTAL STORAGE     : ${formatBytes(
      totalBytes
    )}`
  );

  console.log(
    `B2 FREE LIMIT     : 10.00 GB`
  );

  console.log(
    '================================'
  );
}

run().catch((error) => {
  console.error(
    '❌ Inventory failed',
    error
  );

  process.exit(1);
});