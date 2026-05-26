import { isElectron, apiUrl, buildAuthHeaders } from './mobileAccess';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === 'string' ? result.split(',')[1] : '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload a file to the FacilityOS data server (stored under %ProgramData%/FacilityOS/uploads). */
export async function uploadFile(file, subfolder = 'iltp') {
  if (!file) throw new Error('No file');
  if (file.size > 15 * 1024 * 1024) throw new Error('File exceeds 15 MB limit');

  const data = await readFileAsBase64(file);
  let url;
  if (isElectron()) {
    const config = await window.facilityos.getConfig();
    url = `${config.serverUrl.replace(/\/$/, '')}/api/upload`;
  } else {
    url = apiUrl('/api/upload');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ filename: file.name, data, subfolder }),
  });
  const result = await res.json();
  if (!result.ok) throw new Error(result.error || 'Upload failed');
  return result.data;
}

export async function getUploadUrl(storedPath) {
  if (!storedPath) return null;
  if (storedPath.startsWith('http')) return storedPath;
  const path = storedPath.startsWith('/') ? storedPath : `/api/uploads/${storedPath}`;
  if (isElectron()) {
    const config = await window.facilityos.getConfig();
    return `${config.serverUrl.replace(/\/$/, '')}${path}`;
  }
  return apiUrl(path);
}
