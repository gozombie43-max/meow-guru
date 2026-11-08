export const B2_PDF_PREFIX = String(
  process.env.B2_PDF_PREFIX || 'quiz-pdfs'
)
  .replace(/^\/+|\/+$/g, '');

export const ALLOWED_DOCUMENT_CATEGORIES = new Set([
  'notes',
  'formula',
  'extra',
  'dpp',
]);

export const RESERVED_DOCUMENT_PREFIXES = new Set([
  'question-images',
  'solution-images',
  'notes',
  'quiz-pdfs',
  'tutor-jobs',
]);

export const nameCollator = new Intl.Collator(
  undefined,
  {
    numeric: true,
    sensitivity: 'base',
  }
);

export const normalizeTopic = (topic) =>
  String(topic || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const normalizeCategory = (category) => {
  const normalized =
    normalizeTopic(category || 'notes');

  return ALLOWED_DOCUMENT_CATEGORIES.has(normalized)
    ? normalized
    : 'notes';
};

export const titleFromBlobPath = (blobPath) =>
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

export const allowedExtensions = new Set([
  '.pdf',
  '.doc',
  '.docx',
]);

export const getFileExtension = (
  fileName = ''
) => {
  const match = String(fileName)
    .toLowerCase()
    .match(/\.[a-z0-9]+$/);

  return match ? match[0] : '';
};

export const getContentType = (
  fileName = '',
  mimeType = ''
) => {
  const extension =
    getFileExtension(fileName);

  if (extension === '.pdf') {
    return 'application/pdf';
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

export const verifyPdfMagicBytes = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    return false;
  }
  const header = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
  return header.includes('%PDF-');
};

const ACTIVE_HTML_PATTERN = /<\s*(?:script|svg|html|iframe|object|embed)\b|<!doctype\s+html|javascript\s*:/i;

export const isAllowedDocument = (file) => {
  const extension =
    getFileExtension(
      file?.originalname
    );

  if (!allowedExtensions.has(extension)) {
    return false;
  }

  if (Buffer.isBuffer(file?.buffer)) {
    const sample = file.buffer.subarray(0, Math.min(file.buffer.length, 4096)).toString('utf8');
    if (ACTIVE_HTML_PATTERN.test(sample)) {
      return false;
    }
  }

  if (extension === '.pdf') {
    if (!verifyPdfMagicBytes(file?.buffer)) {
      return false;
    }
  }

  return true;
};

export const getSafeFileName = (
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

export const isDocumentBlob = (
  blobPath
) => {
  if (typeof blobPath !== 'string' || !blobPath) {
    return false;
  }

  if (
    blobPath.startsWith('/') ||
    blobPath.endsWith('/') ||
    blobPath.includes('\\') ||
    blobPath.includes('//') ||
    /[\x00-\x1F\x7F]/.test(blobPath)
  ) {
    return false;
  }

  const segments = blobPath.split('/');
  if (
    (segments.length !== 2 && segments.length !== 3) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return false;
  }

  const topic = segments[0];
  if (
    !/^[a-z0-9-]+$/.test(topic) ||
    RESERVED_DOCUMENT_PREFIXES.has(topic) ||
    topic === B2_PDF_PREFIX
  ) {
    return false;
  }

  if (
    segments.length === 3 &&
    !ALLOWED_DOCUMENT_CATEGORIES.has(segments[1])
  ) {
    return false;
  }

  const fileName = segments[segments.length - 1];
  if (
    fileName.startsWith('.') ||
    /[<>:"|?*\x00-\x1F\\/]/.test(fileName)
  ) {
    return false;
  }

  return allowedExtensions.has(
    getFileExtension(fileName)
  );
};

export const getPdfId = (blobPath) =>
  `pdf-${Buffer
    .from(blobPath, 'utf8')
    .toString('base64url')}`;

export const getBlobPathFromPdfId = (
  id
) => {
  if (typeof id !== 'string' || !id.startsWith('pdf-')) {
    return null;
  }

  const encoded = id.slice(4);
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    return null;
  }

  try {
    const decoded = Buffer
      .from(
        encoded,
        'base64url'
      )
      .toString('utf8');

    return isDocumentBlob(decoded) ? decoded : null;
  } catch {
    return null;
  }
};

export const getB2Key = (blobPath) => {
  const normalized = String(blobPath || '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\\') ||
    normalized.includes('//') ||
    normalized.split('/').some((seg) => seg === '.' || seg === '..')
  ) {
    throw Object.assign(new Error('Invalid document storage path'), { statusCode: 400 });
  }
  return `${B2_PDF_PREFIX}/${normalized}`;
};

export const getLogicalPath = (key) => {
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

export const getPdfPath = (
  topic,
  category = 'notes',
  fileName
) => {
  const normalizedTopic = normalizeTopic(topic);
  if (!normalizedTopic || RESERVED_DOCUMENT_PREFIXES.has(normalizedTopic)) {
    throw Object.assign(new Error('Invalid topic'), { statusCode: 400 });
  }

  const normalizedCategory =
    normalizeCategory(category);

  return (
    `${normalizedTopic}/` +
    `${normalizedCategory}/` +
    `${getSafeFileName(fileName)}`
  );
};
