import express from 'express';
import { CosmosClient } from '@azure/cosmos';
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} from '@azure/storage-blob';

const router = express.Router();
const VIDEO_DB_NAME = process.env.VIDEO_COSMOS_DB || 'quizDB';
const VIDEO_CONTAINER_NAME = process.env.VIDEO_COSMOS_CONTAINER || 'videos';
const VIDEO_STORAGE_ACCOUNT = process.env.AZURE_VIDEO_ACCOUNT_NAME;
const VIDEO_STORAGE_KEY = process.env.AZURE_VIDEO_ACCOUNT_KEY;
const VIDEO_BLOB_CONTAINER = process.env.AZURE_VIDEO_CONTAINER || 'videos';

// Cosmos DB client
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});
const dbContainer = cosmosClient
  .database(VIDEO_DB_NAME)
  .container(VIDEO_CONTAINER_NAME);

// Blob storage credential
const sharedKeyCredential =
  VIDEO_STORAGE_ACCOUNT && VIDEO_STORAGE_KEY
    ? new StorageSharedKeyCredential(VIDEO_STORAGE_ACCOUNT, VIDEO_STORAGE_KEY)
    : null;

const encodeBlobPath = (blobPath) =>
  blobPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

// Helper: generate SAS URL (2 hour expiry)
function generateSasUrl(blobPath) {
  if (!sharedKeyCredential || !VIDEO_STORAGE_ACCOUNT || !VIDEO_BLOB_CONTAINER) {
    throw new Error('Video storage is not configured');
  }

  if (!blobPath) {
    throw new Error('Video blob path is missing');
  }

  const expiresOn = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: VIDEO_BLOB_CONTAINER,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn
    },
    sharedKeyCredential
  ).toString();

  return `https://${VIDEO_STORAGE_ACCOUNT}.blob.core.windows.net/${VIDEO_BLOB_CONTAINER}/${encodeBlobPath(blobPath)}?${sasToken}`;
}

// GET /api/videos?subject=reasoning
router.get('/', async (req, res) => {
  try {
    const { subject } = req.query;
    const querySpec = subject
      ? {
          query: 'SELECT * FROM c WHERE LOWER(c.subject) = @subject ORDER BY c["order"]',
          parameters: [{ name: '@subject', value: String(subject).toLowerCase() }]
        }
      : {
          query: 'SELECT * FROM c ORDER BY c.subject, c["order"]'
        };

    const { resources } = await dbContainer.items.query(querySpec).fetchAll();
    res.json({ success: true, videos: resources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/videos/stream/:id
router.get('/stream/:id', async (req, res) => {
  try {
    const { resources } = await dbContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.params.id }]
      })
      .fetchAll();

    const video = resources[0];
    if (!video) return res.status(404).json({ error: 'Video not found' });

    const url = generateSasUrl(video.blobPath);
    res.json({ success: true, url, video });
  } catch (err) {
    const status = err.message.includes('not configured') || err.message.includes('missing') ? 503 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/videos/metadata
router.post('/metadata', async (req, res) => {
  try {
    const { subject, topic, chapter, blobPath, duration, order, description } = req.body;

    const doc = {
      id: `video-${Date.now()}`,
      subject,
      topic,
      chapter,
      blobPath,
      duration: duration || '',
      order: order || 0,
      description: description || '',
      uploadedAt: new Date().toISOString()
    };

    const { resource } = await dbContainer.items.create(doc);
    res.json({ success: true, video: resource });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/videos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { resources } = await dbContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: req.params.id }]
      })
      .fetchAll();

    const video = resources[0];
    if (!video) return res.status(404).json({ error: 'Video not found' });

    if (!sharedKeyCredential || !VIDEO_STORAGE_ACCOUNT || !VIDEO_BLOB_CONTAINER) {
      return res.status(503).json({ error: 'Video storage is not configured' });
    }

    await dbContainer.item(video.id, video.subject).delete();

    const blobServiceClient = new BlobServiceClient(
      `https://${VIDEO_STORAGE_ACCOUNT}.blob.core.windows.net`,
      sharedKeyCredential
    );
    const containerClient = blobServiceClient.getContainerClient(VIDEO_BLOB_CONTAINER);
    await containerClient.getBlockBlobClient(video.blobPath).deleteIfExists();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
