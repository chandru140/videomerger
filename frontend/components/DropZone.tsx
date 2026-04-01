'use client';

import React, { useCallback, useRef, useState } from 'react';
import { uploadVideo, VideoFileMeta } from '../lib/api';
import toast from 'react-hot-toast';

interface UploadProgress {
  filename: string;
  percent: number;
}

interface DropZoneProps {
  existingCount: number;
  onFilesUploaded: (files: VideoFileMeta[]) => void;
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
const ALLOWED_EXTS = ['.mp4', '.mov', '.avi'];
const MAX_FILES = 10;

function validateFiles(files: File[], existingCount: number): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const valid: File[] = [];
  const remaining = MAX_FILES - existingCount;

  if (files.length > remaining) {
    errors.push(`You can add ${remaining} more video(s). ${files.length - remaining} file(s) ignored.`);
    files = files.slice(0, remaining);
  }

  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
      errors.push(`"${file.name}" is not a supported format (MP4, MOV, AVI only).`);
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}

export default function DropZone({ existingCount, onFilesUploaded }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState<UploadProgress[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (rawFiles: File[]) => {
      const { valid, errors } = validateFiles(rawFiles, existingCount);
      errors.forEach((e) => toast.error(e, { duration: 4000 }));

      if (valid.length === 0) return;

      // Initialize progress slots
      const progressInit: UploadProgress[] = valid.map((f) => ({
        filename: f.name,
        percent: 0,
      }));
      setUploading(progressInit);

      // Pre-allocate slots so results always match the original file selection order (FIFO)
      const uploadedMeta: (VideoFileMeta | null)[] = new Array(valid.length).fill(null);

      await Promise.all(
        valid.map((file, idx) =>
          uploadVideo(file, (percent) => {
            setUploading((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], percent };
              return next;
            });
          })
            .then((meta) => {
              uploadedMeta[idx] = meta; // preserve position, not arrival order
            })
            .catch((err) => {
              toast.error(`Failed to upload "${file.name}": ${err.message}`);
            })
        )
      );

      setUploading([]);

      const succeeded = uploadedMeta.filter((m): m is VideoFileMeta => m !== null);
      if (succeeded.length > 0) {
        onFilesUploaded(succeeded);
        toast.success(
          `${succeeded.length} video${succeeded.length > 1 ? 's' : ''} uploaded!`
        );
      }
    },
    [existingCount, onFilesUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    e.target.value = '';
  };

  const isFull = existingCount >= MAX_FILES;

  return (
    <div>
      <div
        className={`dropzone${isDragActive ? ' active' : ''}`}
        onClick={() => !isFull && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDrop}
        role="button"
        aria-label="Upload video files"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isFull && inputRef.current?.click()}
        style={{ cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.6 : 1 }}
      >
        <span className="dropzone-icon">🎬</span>
        {isFull ? (
          <p className="dropzone-text">Maximum 10 videos reached</p>
        ) : (
          <>
            <p className="dropzone-text">
              {isDragActive ? 'Drop videos here…' : 'Drag & drop videos here'}
            </p>
            <p className="dropzone-hint">
              or <span>click to browse</span> — MP4, MOV, AVI
              · up to {MAX_FILES - existingCount} more file{MAX_FILES - existingCount !== 1 ? 's' : ''}
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          className="dropzone-file-input"
          accept=".mp4,.mov,.avi,video/mp4,video/quicktime,video/x-msvideo"
          multiple
          onChange={onInputChange}
        />
      </div>

      {uploading.length > 0 && (
        <div className="upload-progress-list">
          {uploading.map((item, i) => (
            <div key={i} className="upload-progress-item">
              <div className="upload-progress-header">
                <span className="upload-filename">⬆️ {item.filename}</span>
                <span className="upload-percent">{item.percent}%</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill animated"
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
