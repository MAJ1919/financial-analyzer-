# Portable alternative to render.yaml's native Python runtime — works on Render
# (switch the service to runtime: docker), Cloud Run, Railway, Fly, or a VPS.
# Build context is backend/:  docker build -t finanalyzer-api backend/
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Requirements first so the (slow) pandas/numpy layer is cached across code edits.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Don't run as root.
RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# Shell form so ${PORT} is expanded at runtime — PaaS platforms assign it
# dynamically and it is not known at build time. 8000 is the local fallback.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
