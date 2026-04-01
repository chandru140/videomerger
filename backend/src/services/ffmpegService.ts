import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Resolve FFmpeg binary path: env var > common Homebrew paths > PATH
function resolveFfmpegPath(): string | null {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const candidates = [
    '/opt/homebrew/bin/ffmpeg',   // Apple Silicon Homebrew
    '/usr/local/bin/ffmpeg',       // Intel Homebrew
    '/usr/bin/ffmpeg',             // Linux system package
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const result = execSync('which ffmpeg', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (result) return result;
  } catch { /* not found in PATH */ }
  return null;
}

const ffmpegPath = resolveFfmpegPath();
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log(`[FFmpeg] Using binary: ${ffmpegPath}`);
} else {
  console.warn('[FFmpeg] No binary found! Install FFmpeg: brew install ffmpeg');
  console.warn('[FFmpeg] Or set FFMPEG_PATH env var to point to the binary.');
}

export interface MergeOptions {
  inputFiles: string[];   // Ordered absolute paths to input video files
  outputPath: string;     // Absolute path for the merged output file
  onProgress?: (percent: number) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Write a concat list file for FFmpeg concat demuxer.
 * Each line: file '/absolute/path/to/video.mp4'
 */
function writeConcatList(inputFiles: string[], listPath: string): void {
  const lines = inputFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(listPath, lines, 'utf8');
}

/**
 * Get total duration of all input files (in seconds) for progress calculation.
 */
function getTotalDuration(inputFiles: string[]): Promise<number> {
  const promises = inputFiles.map(
    (file) =>
      new Promise<number>((resolve) => {
        ffmpeg.ffprobe(file, (err, metadata) => {
          if (err || !metadata?.format?.duration) return resolve(0);
          resolve(metadata.format.duration);
        });
      })
  );
  return Promise.all(promises).then((durations) =>
    durations.reduce((sum, d) => sum + d, 0)
  );
}

/**
 * Merge videos using concat demuxer (-c copy for speed).
 * If that fails (codec mismatch), falls back to filter_complex re-encode.
 */
export async function mergeVideos(options: MergeOptions): Promise<void> {
  const { inputFiles, outputPath, onProgress, onComplete, onError } = options;

  const concatListPath = outputPath.replace('.mp4', '_concat.txt');
  writeConcatList(inputFiles, concatListPath);

  const totalDuration = await getTotalDuration(inputFiles);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
    };

    const handleError = (err: Error) => {
      cleanup();
      console.error('[FFmpeg Error]', err.message);
      if (onError) onError(err);
      reject(err);
    };

    const handleProgress = (progress: { timemark: string }) => {
      if (!totalDuration || !onProgress) return;
      // timemark is in format "HH:MM:SS.ms"
      const parts = progress.timemark.split(':');
      if (parts.length < 3) return;
      const seconds =
        parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2]);
      const percent = Math.min(99, Math.round((seconds / totalDuration) * 100));
      onProgress(percent);
    };

    // Strategy 1: concat demuxer with stream copy (fast, no quality loss)
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c', 'copy',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('progress', handleProgress)
      .on('end', () => {
        cleanup();
        if (onProgress) onProgress(100);
        if (onComplete) onComplete();
        resolve();
      })
      .on('error', (err) => {
        // Strategy 2: filter_complex fallback with re-encode
        console.warn('[FFmpeg] Copy failed, falling back to re-encode:', err.message);
        cleanup();
        reEncodeAndMerge(inputFiles, outputPath, totalDuration, onProgress, onComplete, handleError, resolve, reject);
      })
      .run();
  });
}

/**
 * Fallback: re-encode all inputs with filter_complex concat.
 * Handles different codecs, resolutions, or frame rates.
 */
function reEncodeAndMerge(
  inputFiles: string[],
  outputPath: string,
  totalDuration: number,
  onProgress: ((percent: number) => void) | undefined,
  onComplete: (() => void) | undefined,
  onError: (err: Error) => void,
  resolve: () => void,
  reject: (err: Error) => void
): void {
  const cmd = ffmpeg();

  inputFiles.forEach((file) => cmd.input(file));

  const filterInputs = inputFiles.map((_, i) => `[${i}:v][${i}:a]`).join('');
  const filterComplex = `${filterInputs}concat=n=${inputFiles.length}:v=1:a=1[outv][outa]`;

  cmd
    .complexFilter(filterComplex)
    .outputOptions([
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
    ])
    .output(outputPath)
    .on('progress', (progress: { timemark: string }) => {
      if (!totalDuration || !onProgress) return;
      const parts = progress.timemark.split(':');
      if (parts.length < 3) return;
      const seconds =
        parseFloat(parts[0]) * 3600 +
        parseFloat(parts[1]) * 60 +
        parseFloat(parts[2]);
      const percent = Math.min(99, Math.round((seconds / totalDuration) * 100));
      onProgress(percent);
    })
    .on('end', () => {
      if (onProgress) onProgress(100);
      if (onComplete) onComplete();
      resolve();
    })
    .on('error', (err: Error) => {
      onError(err);
      reject(err);
    })
    .run();
}

/**
 * Get video metadata (duration, codec, resolution) for a file.
 */
export function getVideoMetadata(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  codec: string;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        codec: videoStream?.codec_name || 'unknown',
        size: metadata.format.size || 0,
      });
    });
  });
}

/**
 * Delete files and directories safely.
 */
export function cleanupFiles(paths: string[]): void {
  paths.forEach((p) => {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) fs.rmSync(p, { recursive: true, force: true });
        else fs.unlinkSync(p);
      }
    } catch (e) {
      console.warn('[Cleanup] Could not remove:', p, e);
    }
  });
}
