import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import videoRoutes from './routes/video';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Ensure upload and output directories exist
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
const outputDir = path.resolve(process.env.OUTPUT_DIR || './outputs');
[uploadDir, outputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/video', videoRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Video Merger backend running on http://localhost:${PORT}`);
});

export default app;
