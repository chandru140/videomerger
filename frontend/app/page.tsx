'use client';

import { useState, useCallback } from 'react';
import DropZone from '../components/DropZone';
import VideoList from '../components/VideoList';
import MergePanel from '../components/MergePanel';
import { VideoFileMeta } from '../lib/api';

function formatTotalDuration(videos: VideoFileMeta[]): string {
  const total = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
  if (!total) return '—';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTotalSize(videos: VideoFileMeta[]): string {
  const total = videos.reduce((sum, v) => sum + (v.size || 0), 0);
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(0)} KB`;
  if (total < 1024 * 1024 * 1024) return `${(total / (1024 * 1024)).toFixed(1)} MB`;
  return `${(total / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function HomePage() {
  const [videos, setVideos] = useState<VideoFileMeta[]>([]);

  const handleFilesUploaded = useCallback((newFiles: VideoFileMeta[]) => {
    setVideos((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const handleReorder = useCallback((reordered: VideoFileMeta[]) => {
    setVideos(reordered);
  }, []);

  const handleReset = useCallback(() => {
    setVideos([]);
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="logo-icon">🎬</div>
          <h1 className="app-title">Video Merger</h1>
        </div>
        <p className="app-subtitle">
          Upload · Reorder · Merge · Download — in seconds
        </p>
      </header>

      <main className="app-main">
        <div className="section-gap">

          {/* Upload Card */}
          <section className="card" aria-label="Upload videos">
            <div className="card-header">
              <span>⬆️</span>
              <h2 className="card-title">Upload Videos</h2>
            </div>
            <div className="card-body">
              <DropZone
                existingCount={videos.length}
                onFilesUploaded={handleFilesUploaded}
              />
            </div>
          </section>

          {/* Video List Card */}
          <section className="card" aria-label="Video order">
            <div className="card-header">
              <span>🔀</span>
              <h2 className="card-title">
                Video Order
                {videos.length > 0 && (
                  <span
                    style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.8rem',
                      fontWeight: 400,
                      color: 'var(--text-muted)',
                    }}
                  >
                    ({videos.length}/10)
                  </span>
                )}
              </h2>
            </div>

            {videos.length > 0 && (
              <div
                style={{
                  padding: '0.75rem 1.5rem 0',
                  display: 'flex',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div className="stats-bar">
                  <div className="stat-badge">
                    🎥 <strong>{videos.length}</strong> video{videos.length !== 1 ? 's' : ''}
                  </div>
                  <div className="stat-badge">
                    ⏱️ <strong>{formatTotalDuration(videos)}</strong> total
                  </div>
                  <div className="stat-badge">
                    💾 <strong>{formatTotalSize(videos)}</strong> total
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    ↕ Drag to reorder
                  </span>
                </div>
              </div>
            )}

            <div className="card-body">
              <VideoList
                videos={videos}
                onChange={handleReorder}
                onRemove={handleRemove}
              />
            </div>
          </section>

          {/* Merge Card */}
          <section className="card" aria-label="Merge and download">
            <div className="card-header">
              <span>🔗</span>
              <h2 className="card-title">Merge & Download</h2>
            </div>
            <div className="card-body">
              <MergePanel videos={videos} onReset={handleReset} />
            </div>
          </section>

          {/* Footer info */}
          <footer
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              paddingTop: '0.5rem',
            }}
          >
            Powered by FFmpeg · Supports MP4, MOV, AVI · Up to 10 videos
          </footer>
        </div>
      </main>
    </div>
  );
}
