'use client';

import React, { useState } from 'react';
import { startMerge, getDownloadUrl, cleanupJob, VideoFileMeta } from '../lib/api';
import ProgressBar from './ProgressBar';
import toast from 'react-hot-toast';

type Phase = 'idle' | 'merging' | 'completed' | 'error';

interface MergePanelProps {
  videos: VideoFileMeta[];
  onReset: () => void;
}

export default function MergePanel({ videos, onReset }: MergePanelProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const canMerge = videos.length >= 2;

  const handleMerge = async () => {
    if (!canMerge || phase === 'merging') return;

    setPhase('merging');
    setProgress(0);
    setErrorMsg(null);

    const fileIds = videos.map((v) => v.id);

    try {
      const resolvedJobId = await startMerge(fileIds, (event) => {
        if (event.type === 'progress' && event.percent !== undefined) {
          setProgress(event.percent);
        }
        if (event.type === 'start' && event.jobId) {
          setJobId(event.jobId);
        }
      });

      setJobId(resolvedJobId);
      setProgress(100);
      setPhase('completed');
      toast.success('Videos merged successfully! 🎉');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Merge failed';
      setErrorMsg(msg);
      setPhase('error');
      toast.error(`Merge failed: ${msg}`);
    }
  };

  const handleDownload = async () => {
    if (!jobId) return;
    setDownloading(true);

    try {
      const url = getDownloadUrl(jobId);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloaded(true);
      toast.success('Download started! Files will be removed from the server automatically. 🗑️');
      // Auto-reset UI after download — backend already wiped the files
      setTimeout(() => {
        setPhase('idle');
        setProgress(0);
        setJobId(null);
        setErrorMsg(null);
        setDownloaded(false);
        onReset();
      }, 2500);
    } catch {
      toast.error('Failed to download file.');
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = async () => {
    // Only call cleanupJob if the file was NOT already downloaded
    // (backend auto-deletes on download, so calling again would 404)
    if (jobId && !downloaded) {
      try { await cleanupJob(jobId); } catch { /* ignore */ }
    }
    setPhase('idle');
    setProgress(0);
    setJobId(null);
    setErrorMsg(null);
    setDownloaded(false);
    onReset();
  };

  const statusLabel = (() => {
    if (phase === 'merging' && progress < 5)  return '⚙️ Starting FFmpeg…';
    if (phase === 'merging' && progress < 99) return '🔄 Merging videos…';
    if (phase === 'merging')                  return '✅ Finalizing…';
    return '';
  })();

  return (
    <div className="merge-panel">
      {/* Merge Button */}
      {phase !== 'completed' && (
        <button
          className="merge-btn merge-btn-primary btn-icon"
          onClick={handleMerge}
          disabled={!canMerge || phase === 'merging'}
        >
          {phase === 'merging' ? (
            <><span className="pulse-dot" />Merging…</>
          ) : (
            <>🎬 Merge {videos.length} Video{videos.length !== 1 ? 's' : ''}</>
          )}
        </button>
      )}

      {!canMerge && phase === 'idle' && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Upload at least 2 videos to enable merging
        </p>
      )}

      {/* Merge progress */}
      {phase === 'merging' && (
        <div className="merge-status-box">
          <div className="merge-status-header">
            <span className="merge-status-label">
              <span className="pulse-dot" />
              {statusLabel}
            </span>
            <span className="merge-status-percent">{progress}%</span>
          </div>
          <ProgressBar percent={progress} animated height={10} />
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>❌</p>
          <p style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.25rem' }}>
            Merge Failed
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {errorMsg}
          </p>
          <button
            className="merge-btn merge-btn-primary"
            onClick={handleMerge}
            style={{ maxWidth: 200, margin: '0 auto', display: 'block' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Completed state */}
      {phase === 'completed' && (
        <div className="completed-box">
          <span className="completed-icon">✅</span>
          <p className="completed-title">Merge Complete!</p>
          <p className="completed-subtitle">Your merged video is ready to download.</p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="merge-btn merge-btn-secondary btn-icon"
              onClick={handleDownload}
              disabled={downloading}
              style={{ maxWidth: 220 }}
            >
              {downloading ? '⏳ Preparing…' : '⬇️ Download Video'}
            </button>
            <button
              className="merge-btn"
              onClick={handleReset}
              style={{
                maxWidth: 180,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              🔄 Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
