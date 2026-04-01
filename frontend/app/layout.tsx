import type { Metadata } from 'next';
import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Video Merger — Combine Videos Effortlessly',
  description:
    'Upload up to 10 videos (MP4, MOV, AVI), reorder them via drag & drop, and merge them into a single downloadable file with FFmpeg.',
  keywords: ['video merger', 'combine videos', 'ffmpeg', 'mp4 merger'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e2535',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}
