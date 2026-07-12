from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    company_name: str
    fiscal_year_end: Optional[str] = None  # e.g. "December", "March"
    currency: Optional[str] = "SAR"
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    company_name: Optional[str] = None
    fiscal_year_end: Optional[str] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    income_statement: Optional[dict] = None
    balance_sheet: Optional[dict] = None
    cash_flow_statement: Optional[dict] = None
    forecast_data: Optional[dict] = None
    dcf_assumptions: Optional[dict] = None


class ProjectResponse(BaseModel):
    id: str
    company_name: str
    fiscal_year_end: Optional[str] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    income_statement: Optional[dict] = None
    balance_sheet: Optional[dict] = None
    cash_flow_statement: Optional[dict] = None
    forecast_data: Optional[dict] = None
    dcf_assumptions: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
