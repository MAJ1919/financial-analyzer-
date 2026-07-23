from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import routes_projects, routes_upload, routes_analysis, routes_templates
from app.core.config import settings
from app.core.logging_config import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

app = FastAPI(
    title="Financial Analyzer Platform",
    description="Financial Statement Analysis & Business Valuation Platform API",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Global safety net for UNHANDLED exceptions (NFR-S-03)
# ---------------------------------------------------------------------------
# HTTPExceptions (our deliberate 4xx with curated messages) pass through
# FastAPI's own handler untouched. Anything else — an unexpected error whose
# str() or traceback might embed local financial values — is caught here: we
# log only non-sensitive identifiers and return a generic 500, so raw internals
# never reach the client or the logs.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception: %s %s -> %s",
        request.method,
        request.url.path,
        type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# ---------------------------------------------------------------------------
# CORS — allow the Vite dev server (and any future production origin)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(routes_projects.router, prefix="/api/projects", tags=["Projects"])
app.include_router(routes_upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(routes_analysis.router, prefix="/api/analysis", tags=["Analysis"])
app.include_router(routes_templates.router, prefix="/api/templates", tags=["Templates"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "Financial Analyzer Platform API"}
