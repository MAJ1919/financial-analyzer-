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
#
# ORDERING IS LOAD-BEARING — do not convert this back into an
# @app.exception_handler(Exception). That handler lives in Starlette's
# ServerErrorMiddleware, which sits OUTSIDE CORSMiddleware, so its 500 response
# carries no Access-Control-Allow-Origin header. The browser then blocks the
# response and axios reports a bare "Network Error", making every backend crash
# look identical to "the server is down". As an HTTP middleware registered
# BEFORE add_middleware(CORSMiddleware) below, this runs *inside* CORS (Starlette
# builds the stack so the last-added middleware is outermost), so the 500 flows
# back out through CORSMiddleware and reaches the client with its real status.
@app.middleware("http")
async def catch_unhandled_exceptions(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
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


# Last-resort net for anything raised above the middleware above (e.g. inside
# CORSMiddleware itself). Such a response can't carry CORS headers, but it still
# guarantees a generic body rather than a raw traceback.
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception (outer): %s %s -> %s",
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
# Added LAST on purpose => outermost middleware => it can attach CORS headers to
# every response, including the 500s produced by the handler above.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # Optional regex for dynamically-named origins (Vercel preview deploys).
    # `or None` matters: CORSMiddleware compiles this value, and an empty string
    # compiles to a regex that matches every origin.
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
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
