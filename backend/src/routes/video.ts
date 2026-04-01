import { Router } from 'express';
import { upload } from '../middlewares/multer';
import {
  uploadVideos,
  mergeVideosHandler,
  downloadVideo,
  cleanupJob,
} from '../controllers/videoController';

const router = Router();

// POST /api/video/upload — upload up to 10 video files
router.post('/upload', upload.array('videos', 10), uploadVideos);

// POST /api/video/merge — merge ordered files, stream SSE progress
router.post('/merge', mergeVideosHandler);

// GET /api/video/download/:jobId — download merged video
router.get('/download/:jobId', downloadVideo);

// DELETE /api/video/cleanup/:jobId — delete temp + output files
router.delete('/cleanup/:jobId', cleanupJob);

export default router;
