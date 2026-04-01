import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `video-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
  const allowedExts = ['.mp4', '.mov', '.avi'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type "${ext}". Only MP4, MOV, and AVI are supported.`));
  }
};

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '10240', 10);

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSizeMB * 1024 * 1024,
    files: parseInt(process.env.MAX_FILES || '10', 10),
  },
});
