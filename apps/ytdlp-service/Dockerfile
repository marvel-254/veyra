FROM python:3.12-slim

# Install ffmpeg (for processing) and yt-dlp dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp and FastAPI
RUN pip install --no-cache-dir yt-dlp fastapi uvicorn python-multipart

WORKDIR /app
COPY app.py .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

EXPOSE 8000

# Run with uvicorn in production mode
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
