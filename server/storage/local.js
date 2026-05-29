const fs = require('fs');
const path = require('path');
const { assertAllowedUpload, contentTypeForFilename } = require('./validate');

function sanitizeFolder(folder) {
  return String(folder || 'iltp').replace(/[^a-z0-9_-]/gi, '') || 'iltp';
}

function sanitizeFilename(filename) {
  return path.basename(String(filename)).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function createLocalStorageAdapter(uploadsDir) {
  return {
    backend: 'local',
    uploadsDir,

    async save({ filename, data, subfolder = 'iltp' }) {
      assertAllowedUpload(filename);
      const safeFolder = sanitizeFolder(subfolder);
      const safeName = sanitizeFilename(filename);
      const storedName = `${Date.now().toString(36)}-${safeName}`;
      const dir = path.join(uploadsDir, safeFolder);
      fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.from(data, 'base64');
      if (buf.length > 15 * 1024 * 1024) {
        const err = new Error('file too large (max 15 MB)');
        err.status = 413;
        throw err;
      }
      const fullPath = path.join(dir, storedName);
      fs.writeFileSync(fullPath, buf);
      const stored_path = `${safeFolder}/${storedName}`;
      return {
        name: safeName,
        stored_path,
        url: `/api/uploads/${stored_path}`,
        size: buf.length,
      };
    },

    async open(storedPath) {
      const parts = String(storedPath).split('/').filter(Boolean);
      if (parts.length !== 2) return null;
      const [folder, file] = parts.map((p) => path.basename(p));
      const fp = path.resolve(uploadsDir, folder, file);
      if (!fp.startsWith(path.resolve(uploadsDir))) return null;
      if (!fs.existsSync(fp)) return null;
      return {
        stream: fs.createReadStream(fp),
        size: fs.statSync(fp).size,
        contentType: contentTypeForFilename(file),
      };
    },
  };
}

module.exports = { createLocalStorageAdapter, sanitizeFolder, sanitizeFilename };
