from fastapi import APIRouter

from app.models.statement_templates import load_statement_templates

router = APIRouter()


@router.get("/statements")
def get_statement_templates():
    """
    Canonical statement structure for manual entry initialization.

    Returns the full row definitions (key, label, section, level,
    is_header/is_subtotal, industry) for all three statements. The frontend
    fetches this instead of bundling its own copy, so the template has one
    source of truth: backend/app/models/manualEntryTemplate.json.
    """
    return load_statement_templates()
