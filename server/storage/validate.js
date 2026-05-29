const path = require('path');

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt',
]);

const EXT_CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

function extensionOf(filename) {
  return path.extname(String(filename || '')).toLowerCase();
}

function assertAllowedUpload(filename) {
  const ext = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`file type not allowed (${ext || 'none'})`);
    err.status = 415;
    throw err;
  }
  return ext;
}

function contentTypeForFilename(filename) {
  return EXT_CONTENT_TYPES[extensionOf(filename)] || 'application/octet-stream';
}

module.exports = {
  ALLOWED_EXTENSIONS,
  assertAllowedUpload,
  contentTypeForFilename,
};
