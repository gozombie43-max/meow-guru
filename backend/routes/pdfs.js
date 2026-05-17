import express from 'express';
import multer from 'multer';
import {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from '@azure/storage-blob';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const pdfContainerName = process.env.AZURE_STORAGE_CONTAINER_QUIZ_PDFS || 'quiz-pdfs';

const getConnectionValue = (key) => {
  const part = connectionString
    ?.split(';')
    .find((entry) => entry.toLowerCase().startsWith(`${key.toLowerCase()}=`));
  return part ? part.slice(part.indexOf('=') + 1) : '';
};

const storageAccount = getConnectionValue('AccountName');
const storageKey = getConnectionValue('AccountKey');
const sharedKeyCredential =
  storageAccount && storageKey
    ? new StorageSharedKeyCredential(storageAccount, storageKey)
    : null;
const blobServiceClient = connectionString
  ? BlobServiceClient.fromConnectionString(connectionString)
  : null;

const encodeBlobPath = (blobPath) =>
  blobPath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

const normalizeTopic = (topic) =>
  String(topic || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeCategory = (category) => {
  const normalized = normalizeTopic(category || 'notes');
  return ['notes', 'formula', 'extra', 'dpp'].includes(normalized) ? normalized : 'notes';
};

const titleFromBlobPath = (blobPath) =>
  (blobPath.split('/').pop() || blobPath)
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getSafePdfFileName = (fileName) => {
  const baseName = String(fileName || 'document.pdf')
    .split(/[\\/]/)
    .pop()
    .trim()
    .replace(/[<>:"|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ');

  const resolvedName = baseName || 'document.pdf';
  return resolvedName.toLowerCase().endsWith('.pdf')
    ? resolvedName
    : `${resolvedName}.pdf`;
};

const getPdfId = (blobPath) =>
  `pdf-${Buffer.from(blobPath, 'utf8').toString('base64url')}`;

const getBlobPathFromPdfId = (id) => {
  if (!id?.startsWith('pdf-')) return null;

  try {
    return Buffer.from(id.slice(4), 'base64url').toString('utf8');
  } catch {
    return null;
  }
};

const getContainerClient = () => {
  if (!blobServiceClient) {
    throw new Error('PDF storage is not configured');
  }
  return blobServiceClient.getContainerClient(pdfContainerName);
};

const isPdfBlob = (blobPath) => blobPath.toLowerCase().endsWith('.pdf');

const listTopicPdfs = async (topic, category = 'notes') => {
  const containerClient = getContainerClient();
  await containerClient.createIfNotExists();
  const normalizedCategory = normalizeCategory(category);
  const prefixes =
    normalizedCategory === 'notes'
      ? [`${topic}/notes/`, `${topic}/`]
      : [`${topic}/${normalizedCategory}/`];
  const pdfs = [];
  const seen = new Set();

  for (const prefix of prefixes) {
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      if (!isPdfBlob(blob.name) || seen.has(blob.name)) continue;
      if (normalizedCategory === 'notes') {
        const rest = blob.name.slice(`${topic}/`.length);
        if (rest.includes('/') && !rest.startsWith('notes/')) continue;
      }

      seen.add(blob.name);
      pdfs.push({
        id: getPdfId(blob.name),
        title: titleFromBlobPath(blob.name),
        topic,
        category: normalizedCategory,
        blobPath: blob.name,
        fileName: blob.name.split('/').pop() || blob.name,
        size: blob.properties?.contentLength || 0,
        uploadedAt: blob.properties?.createdOn?.toISOString?.() || '',
        updatedAt: blob.properties?.lastModified?.toISOString?.() || '',
        streamUrl: `/api/pdfs/stream/${getPdfId(blob.name)}`
      });
    }
  }

  return pdfs.sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  );
};

const getPdfPath = (topic, category = 'notes', fileName) => {
  const normalizedCategory = normalizeCategory(category);
  return `${topic}/${normalizedCategory}/${getSafePdfFileName(fileName)}`;
};

const generateReadUrl = (blobPath) => {
  if (!sharedKeyCredential || !storageAccount) {
    throw new Error('PDF storage credentials are not configured');
  }

  const expiresOn = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName: pdfContainerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn
    },
    sharedKeyCredential
  ).toString();

  return `https://${storageAccount}.blob.core.windows.net/${pdfContainerName}/${encodeBlobPath(blobPath)}?${sasToken}`;
};

router.get('/', async (req, res) => {
  try {
    const topic = normalizeTopic(req.query.topic);
    const category = normalizeCategory(req.query.category);
    if (!topic) return res.status(400).json({ error: 'topic is required' });

    const pdfs = await listTopicPdfs(topic, category);
    res.json({ success: true, topic, category, pdfs });
  } catch (err) {
    console.error('GET /api/pdfs error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch PDFs' });
  }
});

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    const topic = normalizeTopic(req.body.topic);
    const category = normalizeCategory(req.body.category);
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });
    if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    const containerClient = getContainerClient();
    await containerClient.createIfNotExists();

    const blobPath = getPdfPath(topic, category, req.file.originalname);
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
        blobCacheControl: 'no-cache'
      },
      metadata: {
        topic,
        category,
        originalname: encodeURIComponent(req.file.originalname)
      }
    });

    const pdf = {
      id: getPdfId(blobPath),
      title: titleFromBlobPath(blobPath),
      topic,
      category,
      blobPath,
      fileName: blobPath.split('/').pop() || blobPath,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      streamUrl: `/api/pdfs/stream/${getPdfId(blobPath)}`
    };

    res.status(201).json({ success: true, pdf });
  } catch (err) {
    console.error('POST /api/pdfs error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload PDF' });
  }
});

router.get('/stream/:id', async (req, res) => {
  try {
    const blobPath = getBlobPathFromPdfId(req.params.id);
    if (!blobPath || !isPdfBlob(blobPath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const containerClient = getContainerClient();
    const exists = await containerClient.getBlobClient(blobPath).exists();
    if (!exists) return res.status(404).json({ error: 'PDF not found' });

    const url = generateReadUrl(blobPath);
    res.json({ url });
  } catch (err) {
    console.error('GET /api/pdfs/stream error:', err);
    res.status(500).json({ error: err.message || 'Failed to open PDF' });
  }
});

export default router;
