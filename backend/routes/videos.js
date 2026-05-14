import express from 'express';
import { CosmosClient } from '@azure/cosmos';
import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} from '@azure/storage-blob';

const router = express.Router();

// Cosmos DB client
const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});
const dbContainer = cosmosClient
  .database(process.env.VIDEO_COSMOS_DB)
  .container(process.env.VIDEO_COSMOS_CONTAINER);

// Blob storage credential
const sharedKeyCredential = new StorageSharedKeyCredential(
  process.env.AZURE_VIDEO_ACCOUNT_NAME,
  process.env.AZURE_VIDEO_ACCOUNT_KEY
);

// Helper: generate SAS URL (2 hour expiry)
function generateSasUrl(blobPath) {
  const expiresOn = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: process.env.AZURE_VIDEO_CONTAINER,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn
    },
    sharedKeyCredential
  ).toString();

  return `https://${process.env.AZURE_VIDEO_ACCOUNT_NAME}.blob.core.windows.net/${process.env.AZURE_VIDEO_CONTAINER}/${encodeURIComponent(blobPath)}?${sasToken}`;
}

// GET /api/videos?subject=reasoning
router.get('/', async (req, res) => {
  try {
    const { subject } = req.query;
    const querySpec = subject
      ? {
          query: 'SELECT * FROM c WHERE c.subject = @subject ORDER BY c["order"]',
          parameters: [{ name: '@subject', value: subject }]
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
    res.status(500).json({ error: err.message });
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

    await dbContainer.item(video.id, video.subject).delete();

    const blobServiceClient = new BlobServiceClient(
      `https://${process.env.AZURE_VIDEO_ACCOUNT_NAME}.blob.core.windows.net`,
      sharedKeyCredential
    );
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_VIDEO_CONTAINER);
    await containerClient.getBlockBlobClient(video.blobPath).deleteIfExists();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;