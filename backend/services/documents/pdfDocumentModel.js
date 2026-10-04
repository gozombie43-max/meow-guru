

export const B2_PDF_PREFIX = String(
  process.env.B2_PDF_PREFIX || 'quiz-pdfs'
)
  .replace(/^\/+|\/+$/g, '');

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

  return [
    'notes',
    'formula',
    'extra',
    'dpp',
  ].includes(normalized)
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
  '.html',
  '.htm',
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

export const isAllowedDocument = (file) => {
  const extension =
    getFileExtension(
      file?.originalname
    );

  return allowedExtensions.has(
    extension
  );
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

export const getPdfId = (blobPath) =>
  `pdf-${Buffer
    .from(blobPath, 'utf8')
    .toString('base64url')}`;

export const getBlobPathFromPdfId = (
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

export const isDocumentBlob = (
  blobPath
) =>
  allowedExtensions.has(
    getFileExtension(blobPath)
  );

export const getB2Key = (blobPath) =>
  `${B2_PDF_PREFIX}/${blobPath}`;

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
  const normalizedCategory =
    normalizeCategory(category);

  return (
    `${topic}/` +
    `${normalizedCategory}/` +
    `${getSafeFileName(fileName)}`
  );
};
