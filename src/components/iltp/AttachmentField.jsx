import React, { useState } from 'react';
import { Paperclip, X, ExternalLink } from 'lucide-react';
import DragDropUpload from './DragDropUpload';
import { uploadFile, getUploadUrl } from '../../utils/upload';
import { useAppStore } from '../../store/appStore';

export default function AttachmentField({ attachments = [], onChange }) {
  const { toast } = useAppStore();
  const [uploading, setUploading] = useState(false);
  const list = Array.isArray(attachments) ? attachments : [];

  async function handleFiles(files) {
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const result = await uploadFile(file, 'iltp');
        uploaded.push({ name: result.name, stored_path: result.stored_path, url: result.url });
      }
      onChange([...list, ...uploaded]);
      toast(`${uploaded.length} file(s) uploaded`, 'success');
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  function remove(idx) {
    onChange(list.filter((_, i) => i !== idx));
  }

  async function openAttachment(att) {
    try {
      const url = await getUploadUrl(att.url || att.stored_path);
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      toast('Could not open file', 'error');
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">Attachments</label>
      {list.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {list.map((att, idx) => (
            <li key={att.stored_path || att.url || idx} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
              <Paperclip className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <button type="button" onClick={() => openAttachment(att)} className="flex-1 text-left text-cyan-700 hover:underline truncate">
                {att.name}
              </button>
              <button type="button" onClick={() => remove(idx)} className="text-gray-400 hover:text-red-500" aria-label="Remove">
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <DragDropUpload onFilesSelected={handleFiles} uploading={uploading} />
    </div>
  );
}

export function AttachmentBadges({ attachments, className = '' }) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (!list.length) return null;

  async function open(att) {
    const url = await getUploadUrl(att.url || att.stored_path);
    if (url) window.open(url, '_blank', 'noopener');
  }

  return (
    <div className={`flex flex-wrap gap-1.5 mt-2 ${className}`}>
      {list.map((att, i) => (
        <button
          key={att.stored_path || i}
          type="button"
          onClick={() => open(att)}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
        >
          <ExternalLink className="w-3 h-3" />
          {att.name}
        </button>
      ))}
    </div>
  );
}
