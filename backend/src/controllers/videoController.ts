import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { mergeVideos, getVideoMetadata, cleanupFiles } from '../services/ffmpegService';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
const outputDir = path.resolve(process.env.OUTPUT_DIR || './outputs');

// In-memory job store (use Redis in production)
interface Job {
  id: string;
  inputFiles: string[];
  outputPath: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

const jobs = new Map<string, Job>();

/**
 * POST /api/video/upload
 * Accepts multipart files, returns metadata for each.
 */
export async function uploadVideos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded.' });
      return;
    }

    const fileMetadata = await Promise.all(
      files.map(async (file) => {
        try {
          const meta = await getVideoMetadata(file.path);
          return {
            id: path.basename(file.path),
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            codec: meta.codec,
          };
        } catch {
          return {
            id: path.basename(file.path),
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            duration: 0,
            width: 0,
            height: 0,
            codec: 'unknown',
          };
        }
      })
    );

    res.json({ success: true, files: fileMetadata });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/video/merge
 * Body: { fileIds: string[] } (ordered list of filenames in uploadDir)
 * Streams SSE progress events: { type, percent?, jobId?, error? }
 */
export async function mergeVideosHandler(req: Request, res: Response): Promise<void> {
  const { fileIds } = req.body as { fileIds: string[] };

  if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
    res.status(400).json({ error: 'At least 2 file IDs are required to merge.' });
    return;
  }

  if (fileIds.length > 10) {
    res.status(400).json({ error: 'Maximum 10 files allowed.' });
    return;
  }

  // Resolve and validate input paths
  const inputFiles: string[] = [];
  for (const id of fileIds) {
    const filePath = path.resolve(uploadDir, id);
    // Security: ensure path is within uploadDir
    if (!filePath.startsWith(uploadDir)) {
      res.status(400).json({ error: 'Invalid file reference.' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: `File not found: ${id}` });
      return;
    }
    inputFiles.push(filePath);
  }

  const jobId = uuidv4();
  const outputPath = path.resolve(outputDir, `merged-${jobId}.mp4`);

  const job: Job = {
    id: jobId,
    inputFiles,
    outputPath: null,
    status: 'processing',
  };
  jobs.set(jobId, job);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering

  const sendEvent = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: 'start', jobId });

  try {
    await mergeVideos({
      inputFiles,
      outputPath,
      onProgress: (percent) => {
        sendEvent({ type: 'progress', percent });
      },
      onComplete: () => {
        job.status = 'completed';
        job.outputPath = outputPath;
        jobs.set(jobId, job);
      },
      onError: (err) => {
        job.status = 'failed';
        job.error = err.message;
        jobs.set(jobId, job);
      },
    });

    sendEvent({ type: 'complete', jobId, percent: 100 });
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'FFmpeg processing failed';
    sendEvent({ type: 'error', error: message });
    res.end();

    // Cleanup on failure
    cleanupFiles([outputPath]);
  }
}

/**
 * GET /api/video/download/:jobId
 * Streams the merged video file to the client.
 */
export async function downloadVideo(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job || job.status !== 'completed' || !job.outputPath) {
    res.status(404).json({ error: 'Merged video not found or not ready yet.' });
    return;
  }

  if (!fs.existsSync(job.outputPath)) {
    res.status(404).json({ error: 'Output file has been removed.' });
    return;
  }

  const stat = fs.statSync(job.outputPath);
  const filename = `merged-video-${jobId.slice(0, 8)}.mp4`;

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Stream the file
  const readStream = fs.createReadStream(job.outputPath);
  readStream.pipe(res);

  readStream.on('error', () => {
    res.status(500).json({ error: 'Error streaming file.' });
  });
}

/**
 * DELETE /api/video/cleanup/:jobId
 * Deletes all temp and output files for a job.
 */
export async function cleanupJob(req: Request, res: Response): Promise<void> {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  const filesToDelete: string[] = [];

  if (job) {
    if (job.outputPath) filesToDelete.push(job.outputPath);
    filesToDelete.push(...job.inputFiles);
    jobs.delete(jobId);
  }

  cleanupFiles(filesToDelete);
  res.json({ success: true, message: 'Job files cleaned up.' });
}
