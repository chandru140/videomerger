import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error]', err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Handle Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.message.includes('Too many files')) {
      res.status(400).json({ error: 'Maximum 10 files allowed per upload.' });
      return;
    }
    if (err.message.includes('File too large')) {
      res.status(400).json({ error: 'One or more files exceed the maximum allowed size.' });
      return;
    }
  }

  res.status(statusCode).json({ error: message });
};
