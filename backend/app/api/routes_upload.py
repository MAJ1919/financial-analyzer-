from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from supabase import Client

from app.api.dependencies import get_user_db
from app.models.financial import ManualEntryPayload
from app.services import excel_parser

router = APIRouter()

# Accepted MIME types for the two Excel extensions (NFR-S-01). Some browsers send
# a generic octet-stream for .xls, so that's tolerated only alongside a matching
# extension; the pairing of extension + content-type is what's validated.
_XLSX_MIME = {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
_XLS_MIME = {"application/vnd.ms-excel", "application/octet-stream"}


@router.post("/template/{project_id}")
async def upload_template(
    project_id: str,
    file: UploadFile = File(...),
    db: Client = Depends(get_user_db),
):
    """
    Step 1 & 2 combined: Reads a template-conforming .xlsx file,
    parses it directly into the FinancialStatement models, and saves to DB immediately.
    """
    # NFR-S-01: validate both extension AND content-type before the parser ever
    # sees the bytes, so a non-Excel file renamed to .xlsx is rejected here.
    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if filename.endswith(".xlsx"):
        mime_ok = content_type in _XLSX_MIME
    elif filename.endswith(".xls"):
        mime_ok = content_type in _XLS_MIME
    else:
        mime_ok = False

    if not mime_ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only genuine .xlsx or .xls Excel files are supported.",
        )

    contents = await file.read()
    
    try:
        parsed_data = excel_parser.parse_template_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        
    update_data = {}
    if "income_statement" in parsed_data:
        update_data["income_statement"] = parsed_data["income_statement"]
    if "balance_sheet" in parsed_data:
        update_data["balance_sheet"] = parsed_data["balance_sheet"]
    if "cash_flow_statement" in parsed_data:
        update_data["cash_flow_statement"] = parsed_data["cash_flow_statement"]

    # Clear stale forecast data so the user is forced to re-run it with the new line items
    if update_data:
        update_data["forecast_data"] = None
        result = db.table("projects").update(update_data).eq("id", project_id).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Slim response: the frontend refetches the project for statement data;
    # it only needs the unmapped-row report from this call.
    return {
        "status": "saved",
        "project_id": project_id,
        "unmapped_rows": parsed_data.get("unmapped_rows", {}),
    }

@router.post("/manual/{project_id}")
async def save_manual_entry(
    project_id: str,
    payload: ManualEntryPayload,
    db: Client = Depends(get_user_db),
):
    """
    Alternative ingestion path - direct manual entry from a structured template.
    Stores data in the same format as the confirmed mapping flow.
    """
    update_data = {}
    if payload.income_statement is not None:
        update_data["income_statement"] = payload.income_statement.model_dump()
    if payload.balance_sheet is not None:
        update_data["balance_sheet"] = payload.balance_sheet.model_dump()
    if payload.cash_flow_statement is not None:
        update_data["cash_flow_statement"] = payload.cash_flow_statement.model_dump()

    # Clear stale forecast data
    if update_data:
        update_data["forecast_data"] = None
        result = db.table("projects").update(update_data).eq("id", project_id).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return {"status": "saved", "project_id": project_id}
