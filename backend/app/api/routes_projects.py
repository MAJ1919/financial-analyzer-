from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.api.dependencies import get_db
from app.models.project import ProjectCreate, ProjectUpdate, ProjectResponse

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


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Client = Depends(get_db)):
    """Permanently delete a project."""
    db.table("projects").delete().eq("id", project_id).execute()
