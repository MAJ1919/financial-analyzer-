from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_projects, routes_upload, routes_analysis, routes_templates
from app.core.config import settings

app = FastAPI(
    title="Financial Analyzer Platform",
    description="Financial Statement Analysis & Business Valuation Platform API",
    version="1.0.0",
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
