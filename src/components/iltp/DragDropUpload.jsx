import React, { useState, useRef, useId } from 'react';
import { Upload } from 'lucide-react';

export default function DragDropUpload({ onFilesSelected, uploading, multiple = true }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputId = useId();

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesSelected(files);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging ? 'border-cyan-500 bg-cyan-50' : 'border-gray-300 bg-gray-50 hover:border-cyan-400 hover:bg-cyan-50/50'
      } ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      onClick={() => !uploading && document.getElementById(inputId)?.click()}
    >
      <input
        id={inputId}
        type="file"
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFilesSelected(files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragging ? 'text-cyan-600' : 'text-gray-400'}`} />
      <p className={`text-sm font-medium ${isDragging ? 'text-cyan-700' : 'text-gray-700'}`}>
        {uploading ? 'Uploading…' : isDragging ? 'Drop files here' : 'Drag & drop or click to browse'}
      </p>
      <p className="text-xs text-gray-500 mt-1">PDF, Word, images — max 15 MB each</p>
    </div>
  );
}
