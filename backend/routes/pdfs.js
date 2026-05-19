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

const nameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

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
    .replace(/\.(pdf|html?|docx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const allowedExtensions = new Set(['.pdf', '.html', '.htm', '.doc', '.docx']);

const getFileExtension = (fileName = '') => {
  const match = String(fileName).toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
};

const getContentType = (fileName = '', mimeType = '') => {
  const extension = getFileExtension(fileName);
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.html' || extension === '.htm') return 'text/html; charset=utf-8';
  if (extension === '.doc') return 'application/msword';
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return mimeType || 'application/octet-stream';
};

const isAllowedDocument = (file) => {
  const extension = getFileExtension(file?.originalname);
  return allowedExtensions.has(extension);
};

const getSafeFileName = (fileName) => {
  const baseName = String(fileName || 'document.pdf')
    .split(/[\\/]/)
    .pop()
    .trim()
    .replace(/[<>:"|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ');

  const resolvedName = baseName || 'document.pdf';
  const extension = getFileExtension(resolvedName);
  return allowedExtensions.has(extension)
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

const isDocumentBlob = (blobPath) => allowedExtensions.has(getFileExtension(blobPath));

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
      if (!isDocumentBlob(blob.name) || seen.has(blob.name)) continue;
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
    nameCollator.compare(a.title || a.fileName || '', b.title || b.fileName || '')
  );
};

const getPdfPath = (topic, category = 'notes', fileName) => {
  const normalizedCategory = normalizeCategory(category);
  return `${topic}/${normalizedCategory}/${getSafeFileName(fileName)}`;
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

router.post('/', upload.fields([
  { name: 'files', maxCount: 20 },
  { name: 'pdfs', maxCount: 20 },
  { name: 'pdf', maxCount: 20 }
]), async (req, res) => {
  try {
    const topic = normalizeTopic(req.body.topic);
    const category = normalizeCategory(req.body.category);
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const files = [
      ...(req.files?.files || []),
      ...(req.files?.pdfs || []),
      ...(req.files?.pdf || [])
    ];
    if (!files.length) return res.status(400).json({ error: 'At least one PDF, HTML, DOC, or DOCX file is required' });

    const invalidFile = files.find((file) => !isAllowedDocument(file));
    if (invalidFile) return res.status(400).json({ error: 'Only PDF, HTML, DOC, and DOCX files are allowed' });

    const containerClient = getContainerClient();
    await containerClient.createIfNotExists();

    const pdfs = [];
    for (const file of files) {
      const blobPath = getPdfPath(topic, category, file.originalname);
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: {
          blobContentType: getContentType(file.originalname, file.mimetype),
          blobCacheControl: 'no-cache'
        },
        metadata: {
          topic,
          category,
          originalname: encodeURIComponent(file.originalname)
        }
      });

      pdfs.push({
        id: getPdfId(blobPath),
        title: titleFromBlobPath(blobPath),
        topic,
        category,
        blobPath,
        fileName: blobPath.split('/').pop() || blobPath,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        streamUrl: `/api/pdfs/stream/${getPdfId(blobPath)}`
      });
    }

    res.status(201).json({ success: true, pdf: pdfs[0], pdfs });
  } catch (err) {
    console.error('POST /api/pdfs error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload files' });
  }
});

router.get('/stream/:id', async (req, res) => {
  try {
    const blobPath = getBlobPathFromPdfId(req.params.id);
    if (!blobPath || !isDocumentBlob(blobPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const containerClient = getContainerClient();
    const exists = await containerClient.getBlobClient(blobPath).exists();
    if (!exists) return res.status(404).json({ error: 'File not found' });

    const url = generateReadUrl(blobPath);
    res.json({ url });
  } catch (err) {
    console.error('GET /api/pdfs/stream error:', err);
    res.status(500).json({ error: err.message || 'Failed to open PDF' });
  }
});

export default router;
