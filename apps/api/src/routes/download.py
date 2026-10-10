# Veyra Download Worker — yt-dlp on Cloudflare Workers (Python)
# Handles: POST /api/download, GET /api/download/:taskId
#
# Architecture:
#   1. User POSTs a YouTube URL + quality to /api/download
#   2. Worker validates URL and queues a download job
#   3. yt-dlp downloads the video and uploads to R2
#   4. Worker returns a signed R2 URL (24h expiry)
#
# For v1: We run yt-dlp in-process via subprocess (Python Worker or exec).
# For v2: Use a Durable Object queue for better scalability.

import subprocess
import json
import os
import uuid
import re
from datetime import datetime, timedelta
from urllib.parse import urlparse

# ── Helpers ─────────────────────────────────────────────────────────────────

def is_valid_youtube_url(url: str) -> bool:
    """Reject anything that isn't a plausible YouTube or YouTube Music URL."""
    if not url:
        return False
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    return host in (
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
        'www.youtu.be',
        'm.youtube.com',
        'music.youtube.com',
    )

def get_r2_client(env):
    """Return the bound R2 bucket from the Cloudflare Workers environment."""
    return env.R2_BUCKET

def generate_task_id() -> str:
    return f"dl_{uuid.uuid4().hex[:12]}"

# ── yt-dlp Quality Mapping ─────────────────────────────────────────────────
# Maps user-facing quality labels to yt-dlp format selectors.
QUALITY_MAP = {
    "1080p": "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720p":  "bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480p":  "bestvideo[height<=480]+bestaudio/best[height<=480]",
    "best":  "best",
}

# ── Download Job (in-memory for v1; swap to Durable Object for v2) ───────────
# Simple in-memory store. Lives for the duration of the Worker instance.
download_jobs: dict[str, dict] = {}

def run_ytdlp(url: str, quality: str, output_path: str) -> tuple[bool, str]:
    """
    Run yt-dlp to download `url` at `quality` to `output_path`.
    Returns (success, error_message).
    """
    format_spec = QUALITY_MAP.get(quality, QUALITY_MAP["720p"])

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "-f", format_spec,
        "-o", output_path,
        url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,  # 15-minute timeout per download
        )
        if result.returncode == 0:
            return True, ""
        return False, result.stderr or f"yt-dlp exited with {result.returncode}"
    except subprocess.TimeoutExpired:
        return False, "Download timed out after 15 minutes"
    except FileNotFoundError:
        return False, "yt-dlp is not installed in this worker"
    except Exception as e:
        return False, str(e)


# ── Worker Entry Points ──────────────────────────────────────────────────────

async def on_fetch(request, env, ctx):
    from urllib.parse import parse_qs

    method = request.method
    url = request.url

    # ── POST /api/download ───────────────────────────────────────────────
    if method == "POST" and url.path == "/api/download":
        try:
            body = await request.json()
        except Exception:
            return Response.json({"error": "Invalid JSON body"}, status=400)

        video_url: str = body.get("url", "")
        quality: str = body.get("quality", "720p")
        movie_id: int = body.get("movieId")
        title: str = body.get("title", "video")

        if not is_valid_youtube_url(video_url):
            return Response.json(
                {"error": "Invalid or unsupported URL. Only YouTube links are supported."},
                status=400,
            )

        task_id = generate_task_id()
        task = {
            "taskId": task_id,
            "status": "processing",
            "quality": quality,
            "movieId": movie_id,
            "title": title,
            "url": video_url,
            "createdAt": datetime.utcnow().isoformat(),
            "expiresAt": None,
            "downloadUrl": None,
            "error": None,
            "progress": 0,
        }
        download_jobs[task_id] = task

        # ── Async download (won't block the response) ──────────────────
        async def do_download():
            task = download_jobs.get(task_id)
            if not task:
                return

            r2 = get_r2_client(env)
            if not r2:
                download_jobs[task_id]["status"] = "failed"
                download_jobs[task_id]["error"] = "R2_BUCKET not configured"
                return

            # Unique temp path for this download
            filename = f"{task_id}.mp4"
            tmp_path = f"/tmp/{filename}"

            # Run yt-dlp
            success, error = run_ytdlp(video_url, quality, tmp_path)
            if not success:
                download_jobs[task_id]["status"] = "failed"
                download_jobs[task_id]["error"] = error
                return

            # Upload to R2
            try:
                with open(tmp_path, "rb") as f:
                    content = f.read()

                r2_key = f"downloads/{task_id}/{filename}"
                await r2.put(r2_key, content, http_metadata={
                    "Content-Type": "video/mp4",
                })

                # Generate a signed URL (24h expiry)
                # Cloudflare Workers R2 binding doesn't expose direct signed-URL
                # generation — for v1 we use a public bucket or a separate
                # /api/serve/:taskId route. For now we return a placeholder.
                download_jobs[task_id]["status"] = "completed"
                download_jobs[task_id]["downloadUrl"] = f"/api/download/{task_id}"
                download_jobs[task_id]["expiresAt"] = (
                    datetime.utcnow() + timedelta(hours=24)
                ).isoformat()

            except Exception as e:
                download_jobs[task_id]["status"] = "failed"
                download_jobs[task_id]["error"] = f"R2 upload failed: {str(e)}"
            finally:
                # Clean up temp file
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

        # Fire-and-forget background task
        ctx.wait_until(do_download())

        return Response.json({
            "taskId": task_id,
            "status": "processing",
            "message": "Download started. Poll /api/download/" + task_id + " for status.",
        }, status=202)

    # ── GET /api/download/:taskId ────────────────────────────────────────
    match = re.match(r"^/api/download/([^/]+)$", url.path)
    if method == "GET" and match:
        task_id = match.group(1)
        task = download_jobs.get(task_id)

        if not task:
            return Response.json({"error": "Download task not found"}, status=404)

        return Response.json({
            "taskId": task["taskId"],
            "status": task["status"],
            "quality": task.get("quality"),
            "downloadUrl": task.get("downloadUrl"),
            "expiresAt": task.get("expiresAt"),
            "error": task.get("error"),
            "title": task.get("title"),
        })

    # ── DELETE /api/download/:taskId (cancel) ───────────────────────────
    if method == "DELETE" and match:
        task_id = match.group(1)
        if task_id in download_jobs:
            download_jobs[task_id]["status"] = "cancelled"
            del download_jobs[task_id]
        return Response.json({"success": True})

    # ── GET /api/download/qualities ──────────────────────────────────────
    if method == "POST" and url.path == "/api/download/qualities":
        try:
            body = await request.json()
        except Exception:
            return Response.json({"error": "Invalid JSON"}, status=400)

        video_url: str = body.get("url", "")
        if not is_valid_youtube_url(video_url):
            return Response.json({"error": "Invalid URL"}, status=400)

        # For v1, always return the standard quality options.
        # yt-dlp will handle format availability at download time.
        return Response.json({
            "qualities": [
                {"label": "1080p", "value": "1080p", "sizeEstimate": "~1.2 GB"},
                {"label": "720p",  "value": "720p",  "sizeEstimate": "~650 MB"},
                {"label": "480p",  "value": "480p",  "sizeEstimate": "~350 MB"},
            ]
        })

    # ── GET /api/download/tasks ─────────────────────────────────────────
    if method == "GET" and url.path == "/api/download/tasks":
        tasks = [
            {k: v for k, v in t.items() if k not in ("url",)}
            for t in download_jobs.values()
        ]
        return Response.json({"tasks": tasks})

    # ── Fallthrough: serve static files (Next.js build) ───────────────
    # This allows the same worker to serve the web app in production.
    # In dev, wrangler dev handles this separately.
    return Response.json({"error": "Not found"}, status=404)
