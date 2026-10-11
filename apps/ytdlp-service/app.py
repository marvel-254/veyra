"""
Veyra yt-dlp download service — FastAPI
Receives download requests from the Cloudflare Worker and runs yt-dlp.
Serves as the yt-dlp execution engine (Cloudflare Workers can't run Python).
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
import subprocess
import os
import uuid
import asyncio
import re
import urllib.parse
from datetime import datetime, timedelta

app = FastAPI(title="Veyra yt-dlp Service", version="1.0.0")

# Allow the Cloudflare Worker to call this service (restrict in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Worker origin only in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (replace with Redis/DB in production)
jobs: dict[str, dict] = {}

# yt-dlp quality format selectors
QUALITY_FORMATS = {
    "1080p": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p":  "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480p":  "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]",
    "best":  "best",
}


# ── Models ────────────────────────────────────────────────────────────────────

class DownloadRequest(BaseModel):
    url: str
    quality: str = "720p"
    title: Optional[str] = None
    movieId: Optional[int] = None

class QualityOption(BaseModel):
    label: str
    value: str
    sizeEstimate: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def is_valid_youtube_url(url: str) -> bool:
    if not url:
        return False
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    return host in {
        "www.youtube.com", "youtube.com", "youtu.be", "www.youtu.be",
        "m.youtube.com", "music.youtube.com",
    }


def get_youtube_video_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r'(?:v=|/v/|/embed/)([a-zA-Z0-9_-]{11})',
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def run_ytdlp(url: str, quality: str, output_path: str) -> tuple[bool, str]:
    """Run yt-dlp to download a video. Returns (success, error_message)."""
    format_spec = QUALITY_FORMATS.get(quality, QUALITY_FORMATS["720p"])

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--no-progress",
        "-f", format_spec,
        "-o", output_path,
        "--merge-output-format", "mp4",
        url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,  # 15-minute timeout
        )
        if result.returncode == 0:
            return True, ""
        return False, result.stderr or f"yt-dlp exited {result.returncode}"
    except subprocess.TimeoutExpired:
        return False, "Download timed out (15 min limit)"
    except FileNotFoundError:
        return False, "yt-dlp not found"
    except Exception as e:
        return False, str(e)


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "veyra-ytdlp", "timestamp": datetime.utcnow().isoformat()}


@app.get("/")
async def root():
    return {"app": "Veyra yt-dlp Service", "version": "1.0.0"}


@app.post("/download")
async def start_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Queue a download. Returns task_id immediately."""
    if not is_valid_youtube_url(req.url):
        raise HTTPException(400, "Invalid or unsupported URL. Only YouTube is supported.")

    if req.quality not in QUALITY_FORMATS:
        raise HTTPException(400, f"Quality must be one of: {', '.join(QUALITY_FORMATS.keys())}")

    video_id = get_youtube_video_id(req.url) or uuid.uuid4().hex[:8]
    task_id = f"veyra_{uuid.uuid4().hex[:12]}"

    safe_title = re.sub(r'[^\w\-_. ]', '_', (req.title or video_id)[:50])
    filename = f"{safe_title}_{task_id}.mp4"
    tmp_path = f"/tmp/{task_id}.mp4"

    job = {
        "taskId": task_id,
        "status": "queued",
        "url": req.url,
        "quality": req.quality,
        "title": req.title or video_id,
        "movieId": req.movieId,
        "filename": filename,
        "tmpPath": tmp_path,
        "createdAt": datetime.utcnow().isoformat(),
        "completedAt": None,
        "error": None,
        "expiresAt": None,
        "fileSize": None,
    }
    jobs[task_id] = job

    # Run download in background
    background_tasks.add_task(process_download, task_id)

    return JSONResponse({
        "taskId": task_id,
        "status": "queued",
        "message": "Download queued. Poll GET /download/{task_id} for status.",
        "quality": req.quality,
    }, status_code=202)


async def process_download(task_id: str):
    """Background task: run yt-dlp and clean up."""
    job = jobs.get(task_id)
    if not job:
        return

    jobs[task_id]["status"] = "processing"

    success, error = await asyncio.to_thread(
        run_ytdlp,
        job["url"],
        job["quality"],
        job["tmpPath"],
    )

    if not success:
        jobs[task_id]["status"] = "failed"
        jobs[task_id]["error"] = error
        return

    # Get file size
    try:
        size = os.path.getsize(job["tmpPath"])
        jobs[task_id]["fileSize"] = size
    except Exception:
        pass

    jobs[task_id]["status"] = "completed"
    jobs[task_id]["completedAt"] = datetime.utcnow().isoformat()
    jobs[task_id]["expiresAt"] = (datetime.utcnow() + timedelta(hours=24)).isoformat()

    # Clean up after 1 hour
    async def cleanup():
        await asyncio.sleep(3600)
        try:
            if os.path.exists(job["tmpPath"]):
                os.remove(job["tmpPath"])
        except Exception:
            pass

    asyncio.create_task(cleanup())


@app.get("/download/{task_id}")
async def get_download_status(task_id: str):
    """Poll download status. When completed, returns the file URL."""
    job = jobs.get(task_id)
    if not job:
        raise HTTPException(404, "Download task not found")

    response = {
        "taskId": job["taskId"],
        "status": job["status"],
        "quality": job["quality"],
        "title": job["title"],
        "createdAt": job["createdAt"],
        "error": job["error"],
    }

    if job["status"] == "completed":
        response["url"] = f"/download/{task_id}/file"
        response["expiresAt"] = job["expiresAt"]
        response["fileSize"] = job["fileSize"]

    return JSONResponse(response)


@app.get("/download/{task_id}/file")
async def serve_download_file(task_id: str):
    """Serve the downloaded file. Expires after 24h."""
    job = jobs.get(task_id)
    if not job:
        raise HTTPException(404, "Download not found")
    if job["status"] != "completed":
        raise HTTPException(400, "Download not ready yet")

    tmp_path = job["tmpPath"]
    if not os.path.exists(tmp_path):
        raise HTTPException(404, "File expired and was deleted")

    return FileResponse(
        tmp_path,
        media_type="video/mp4",
        filename=job["filename"],
        headers={"Content-Disposition": f'attachment; filename="{job["filename"]}"'},
    )


@app.delete("/download/{task_id}")
async def cancel_download(task_id: str):
    """Cancel/delete a download task."""
    if task_id not in jobs:
        raise HTTPException(404, "Task not found")

    job = jobs.pop(task_id)

    # Clean up temp file
    try:
        if os.path.exists(job["tmpPath"]):
            os.remove(job["tmpPath"])
    except Exception:
        pass

    return JSONResponse({"success": True, "taskId": task_id})


@app.get("/qualities")
async def list_qualities():
    """Return available quality options (fixed for v1)."""
    return JSONResponse({
        "qualities": [
            {"label": "1080p", "value": "1080p", "sizeEstimate": "~1.2 GB"},
            {"label": "720p",  "value": "720p",  "sizeEstimate": "~650 MB"},
            {"label": "480p",  "value": "480p",  "sizeEstimate": "~350 MB"},
            {"label": "Best",  "value": "best",  "sizeEstimate": "Best available"},
        ]
    })


@app.post("/qualities")
async def preview_qualities(req: DownloadRequest):
    """Return quality options for a given URL (yt-dlp dry-run for format info)."""
    if not is_valid_youtube_url(req.url):
        raise HTTPException(400, "Invalid YouTube URL")

    # For v1, always return standard options. In v2, run `yt-dlp --list-formats` to show real options.
    return JSONResponse({
        "qualities": [
            {"label": "1080p", "value": "1080p", "sizeEstimate": "~1.2 GB"},
            {"label": "720p",  "value": "720p",  "sizeEstimate": "~650 MB"},
            {"label": "480p",  "value": "480p",  "sizeEstimate": "~350 MB"},
        ]
    })


# ── Run locally ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
