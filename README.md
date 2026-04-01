# 🎬 Video Merger

A production-ready web application to upload, reorder, and merge multiple video files into one downloadable file — powered by **Next.js 14**, **Express**, and **FFmpeg**.

---

## 🏗️ Architecture

```
Video merger/
├── backend/    → Express + Node.js + FFmpeg (deploy to Render/Railway)
└── frontend/   → Next.js 14 App Router (deploy to Vercel)
```

**Why split?** Vercel serverless functions don't support FFmpeg binaries. The backend runs as a persistent Node.js server.

---

## ⚡ Features

| Feature | Details |
|---|---|
| Upload | Up to 10 videos - MP4, MOV, AVI - with per-file progress bars |
| Reorder  | Drag & drop to change merge order |
| Merge    | FFmpeg concat demuxer (`-c copy`) → fast fallback to `filter_complex` re-encode |
| Progress | Real-time SSE stream from backend |
| Download | Streams merged MP4 directly from server |
| Cleanup  | Temp files auto-deleted after download |

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- FFmpeg is **bundled** via `ffmpeg-static` — no install needed

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Edit if needed
npm run dev               # Starts at http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
# .env.local already has NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev               # Starts at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🌐 Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set env var: NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Backend → Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your repo, set root to `backend/`
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add env var: `FRONTEND_URL=https://your-frontend.vercel.app`

### Backend → Railway

```bash
cd backend
railway login
railway init
railway up
```

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin |
| `UPLOAD_DIR` | `./uploads` | Temp upload directory |
| `OUTPUT_DIR` | `./outputs` | Merged video output directory |
| `MAX_FILES` | `10` | Max files per upload |
| `MAX_FILE_SIZE_MB` | `10240` | Max file size (10 GB default) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL |

---

## 🧠 FFmpeg Commands Used

### Strategy 1: Concat Demuxer (fast, no re-encode)
```bash
# concat.txt:
# file '/path/to/video1.mp4'
# file '/path/to/video2.mp4'

ffmpeg -f concat -safe 0 -i concat.txt \
  -c copy -movflags +faststart output.mp4
```
Used when all input videos share the same codec, resolution, and frame rate.

### Strategy 2: Filter Complex (re-encode fallback)
```bash
ffmpeg -i video1.mp4 -i video2.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" \
  -c:v libx264 -preset fast -crf 23 \
  -c:a aac -b:a 192k \
  -movflags +faststart output.mp4
```
Used when videos have different codecs or resolutions. Normalizes everything to H.264/AAC.

---

## 📁 Project Structure

```
backend/src/
├── index.ts                  ← Server bootstrap
├── routes/video.ts           ← Route definitions
├── controllers/videoController.ts  ← Request handlers
├── services/ffmpegService.ts ← FFmpeg logic
└── middlewares/
    ├── multer.ts             ← File upload config
    └── errorHandler.ts       ← Global error handler

frontend/
├── app/
│   ├── layout.tsx            ← Root layout + toasts
│   └── page.tsx              ← Main page
├── components/
│   ├── DropZone.tsx          ← Upload with progress
│   ├── VideoList.tsx         ← Sortable drag-and-drop list
│   ├── MergePanel.tsx        ← Merge controls + SSE
│   └── ProgressBar.tsx       ← Animated progress bar
├── lib/api.ts                ← API client
└── styles/globals.css        ← Design system
```

---

## 🧪 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET`    | `/api/health` | Health check |
| `POST`   | `/api/video/upload` | Upload 1–10 video files |
| `POST`   | `/api/video/merge` | Start merge → SSE stream |
| `GET`    | `/api/video/download/:jobId` | Download merged video |
| `DELETE` | `/api/video/cleanup/:jobId` | Delete temp files |
