'use client';

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { VideoFileMeta } from '../lib/api';

/* ─── Helper: format seconds to mm:ss ─── */
function formatDuration(seconds: number): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── Helper: format bytes ─── */
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ─── Thumbnail placeholder ─── */
function VideoThumbnail({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toUpperCase() || 'VID';
  const colors: Record<string, string> = {
    MP4: '#8b5cf6',
    MOV: '#3b82f6',
    AVI: '#10b981',
  };
  const bg = colors[ext] || '#6366f1';

  return (
    <div
      className="video-thumbnail"
      style={{ background: `linear-gradient(135deg, ${bg}33, ${bg}11)` }}
    >
      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: bg, letterSpacing: '0.05em' }}>
        {ext}
      </span>
    </div>
  );
}

/* ─── Shared card content (used for both sortable item & drag overlay) ─── */
function VideoCard({
  video,
  index,
  onRemove,
  isDragging = false,
  dragHandleProps = {},
}: {
  video: VideoFileMeta;
  index: number;
  onRemove?: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}) {
  return (
    <div className={`video-item${isDragging ? ' dragging' : ''}`}>
      {/* Drag handle */}
      <div
        className="drag-handle"
        style={{ touchAction: 'none' }}
        {...dragHandleProps}
        aria-label="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="11" cy="12" r="1.5" />
        </svg>
      </div>

      {/* Order number */}
      <div className="video-order">{index + 1}</div>

      {/* Thumbnail */}
      <VideoThumbnail filename={video.originalName} />

      {/* Info */}
      <div className="video-info">
        <p className="video-name">{video.originalName}</p>
        <div className="video-meta">
          <span className="video-meta-badge">🕐 {formatDuration(video.duration)}</span>
          <span className="video-meta-badge">📦 {formatSize(video.size)}</span>
          {video.width > 0 && (
            <span className="video-meta-badge">🖥️ {video.width}×{video.height}</span>
          )}
          {video.codec !== 'unknown' && (
            <span className="video-meta-badge">🎞️ {video.codec}</span>
          )}
        </div>
      </div>

      {/* Remove */}
      {onRemove && (
        <button
          className="video-remove-btn"
          onClick={() => onRemove(video.id)}
          aria-label={`Remove ${video.originalName}`}
          title="Remove video"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ─── Sortable wrapper ─── */
function SortableItem({
  video,
  index,
  onRemove,
}: {
  video: VideoFileMeta;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: video.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,   // placeholder stays but fades out
    zIndex: isDragging ? 0 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <VideoCard
        video={video}
        index={index}
        onRemove={onRemove}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ─── VideoList ─── */
interface VideoListProps {
  videos: VideoFileMeta[];
  onChange: (videos: VideoFileMeta[]) => void;
  onRemove: (id: string) => void;
}

export default function VideoList({ videos, onChange, onRemove }: VideoListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeVideo = activeId ? videos.find((v) => v.id === activeId) ?? null : null;
  const activeIndex = activeId ? videos.findIndex((v) => v.id === activeId) : -1;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = videos.findIndex((v) => v.id === active.id);
      const newIndex = videos.findIndex((v) => v.id === over.id);
      onChange(arrayMove(videos, oldIndex, newIndex));
    }
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">🎥</span>
        Upload videos above to get started
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={videos.map((v) => v.id)} strategy={verticalListSortingStrategy}>
        <div className="video-list">
          {videos.map((video, index) => (
            <SortableItem
              key={video.id}
              video={video}
              index={index}
              onRemove={onRemove}
            />
          ))}
        </div>
      </SortableContext>

      {/* DragOverlay: renders a floating ghost card that follows the cursor */}
      <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
        {activeVideo ? (
          <VideoCard
            video={activeVideo}
            index={activeIndex}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
