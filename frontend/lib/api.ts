import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: API_URL });

export interface VideoFileMeta {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  duration: number;
  width: number;
  height: number;
  codec: string;
}

/**
 * Upload a single video file with progress tracking.
 */
export async function uploadVideo(
  file: File,
  onProgress: (percent: number) => void
): Promise<VideoFileMeta> {
  const formData = new FormData();
  formData.append('videos', file);

  const response = await api.post<{ success: boolean; files: VideoFileMeta[] }>(
    '/api/video/upload',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(percent);
        }
      },
    }
  );

  return response.data.files[0];
}

export type MergeEventType = 'start' | 'progress' | 'complete' | 'error';

export interface MergeEvent {
  type: MergeEventType;
  percent?: number;
  jobId?: string;
  error?: string;
}

/**
 * Start merge job via SSE (Server-Sent Events).
 * Returns a cleanup function to close the connection.
 */
export function startMerge(
  fileIds: string[],
  onEvent: (event: MergeEvent) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    let jobId: string | null = null;

    // POST + SSE via fetch (EventSource only supports GET)
    fetch(`${API_URL}/api/video/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds }),
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        const error = await res.json().catch(() => ({ error: 'Merge request failed' }));
        reject(new Error(error.error || 'Merge request failed'));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = ({ done, value }: ReadableStreamReadResult<Uint8Array>): unknown => {
        if (done) {
          if (jobId) resolve(jobId);
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: MergeEvent = JSON.parse(line.slice(6));
              if (event.type === 'start' && event.jobId) jobId = event.jobId;
              if (event.type === 'error') reject(new Error(event.error || 'FFmpeg error'));
              onEvent(event);
            } catch {
              /* ignore parse errors */
            }
          }
        }

        return reader.read().then(processChunk);
      };

      reader.read().then(processChunk).catch(reject);
    }).catch(reject);
  });
}

/**
 * Get the download URL for a merged job.
 */
export function getDownloadUrl(jobId: string): string {
  return `${API_URL}/api/video/download/${jobId}`;
}

/**
 * Clean up all temp files for a job.
 */
export async function cleanupJob(jobId: string): Promise<void> {
  await api.delete(`/api/video/cleanup/${jobId}`);
}
