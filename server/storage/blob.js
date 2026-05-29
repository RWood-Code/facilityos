const { BlobServiceClient } = require('@azure/storage-blob');
const { sanitizeFolder, sanitizeFilename } = require('./local');
const { assertAllowedUpload, contentTypeForFilename } = require('./validate');

function createBlobStorageAdapter({ connectionString, containerName = 'uploads' }) {
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING required for blob storage');
  }

  const service = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = service.getContainerClient(containerName);

  async function ensureContainer() {
    await containerClient.createIfNotExists();
  }

  return {
    backend: 'blob',
    containerName,

    async save({ filename, data, subfolder = 'iltp' }) {
      assertAllowedUpload(filename);
      await ensureContainer();
      const safeFolder = sanitizeFolder(subfolder);
      const safeName = sanitizeFilename(filename);
      const storedName = `${Date.now().toString(36)}-${safeName}`;
      const blobName = `${safeFolder}/${storedName}`;
      const buf = Buffer.from(data, 'base64');
      if (buf.length > 15 * 1024 * 1024) {
        const err = new Error('file too large (max 15 MB)');
        err.status = 413;
        throw err;
      }
      const block = containerClient.getBlockBlobClient(blobName);
      const contentType = contentTypeForFilename(safeName);
      await block.uploadData(buf, { blobHTTPHeaders: { blobContentType: contentType } });
      const stored_path = blobName;
      return {
        name: safeName,
        stored_path,
        url: `/api/uploads/${stored_path}`,
        size: buf.length,
      };
    },

    async open(storedPath) {
      await ensureContainer();
      const blobName = String(storedPath).replace(/^\/+/, '');
      const block = containerClient.getBlockBlobClient(blobName);
      if (!(await block.exists())) return null;
      const props = await block.getProperties();
      const download = await block.download(0);
      return {
        stream: download.readableStreamBody,
        size: props.contentLength,
        contentType: props.contentType,
      };
    },
  };
}

module.exports = { createBlobStorageAdapter };
