'use client';

import React from 'react';

interface ProgressBarProps {
  percent: number;
  animated?: boolean;
  label?: string;
  height?: number;
}

export default function ProgressBar({
  percent,
  animated = false,
  label,
  height = 8,
}: ProgressBarProps) {
  return (
    <div>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.4rem',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>{label}</span>
          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{percent}%</span>
        </div>
      )}
      <div className="progress-bar-track" style={{ height }}>
        <div
          className={`progress-bar-fill${animated && percent < 100 ? ' animated' : ''}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
