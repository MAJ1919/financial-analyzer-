import re
import urllib.parse

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import Client

from app.api.dependencies import get_db
from app.models.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.excel_export import export_project_to_xlsx_bytes

router = APIRouter()


@router.get("/", response_model=list[ProjectResponse])
def list_projects(db: Client = Depends(get_db)):
    """Return all saved projects (Companies landing page)."""
    result = db.table("projects").select("*").order("created_at", desc=True).execute()
    return result.data


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Client = Depends(get_db)):
    """Fetch a single project by ID."""
    result = db.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return result.data[0]


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Client = Depends(get_db)):
    """Create a new project shell (no financial data yet)."""
    result = db.table("projects").insert(payload.model_dump()).execute()
    return result.data[0]


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, payload: ProjectUpdate, db: Client = Depends(get_db)):
    """Partial update of project metadata or financial data."""
    result = (
        db.table("projects")
        .update(payload.model_dump(exclude_none=True))
        .eq("id", project_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return result.data[0]


@router.get("/{project_id}/export/excel")
def export_project_excel(project_id: str, db: Client = Depends(get_db)):
    """
    Build and stream a fully-formatted, formula-driven Excel workbook for the
    project: the three statements (actuals + a live projected model), Ratios,
    Horizontal Analysis, a DCF with sensitivity, and an editable Assumptions
    panel. Projections reproduce the app's forecasting engine as live formulas.
    """
    result = db.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project = result.data[0]
    try:
        xlsx_bytes = export_project_to_xlsx_bytes(project)
    except ValueError as exc:
        # e.g. project has no statement data yet
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    company = (project.get("company_name") or "Project").strip()
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", company).strip("_") or "Project"
    filename = f"{safe}_Financial_Model.xlsx"
    # RFC 5987 encoding so non-ASCII company names survive the header
    disposition = (
        f"attachment; filename=\"{filename}\"; "
        f"filename*=UTF-8''{urllib.parse.quote(filename)}"
    )
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": disposition},
    )


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Client = Depends(get_db)):
    """Permanently delete a project."""
    result = db.table("projects").delete().eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
