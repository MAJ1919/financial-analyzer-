from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.api.dependencies import get_db
from app.services import analysis_engine
from app.services.forecasting_engine import (
    run_forecast,
    calculate_historical_assumptions,
)

class ForecastInputsPayload(BaseModel):
    # ── Core assumptions ──
    revenue_growth_rate: float = 10.0
    # Optional per-year growth override (one % per forecast year).
    # When provided, it takes precedence over revenue_growth_rate.
    revenue_growth_rates: list[float] | None = None
    tax_rate: float = 25.0
    capex_as_pct_of_revenue: float = 3.0
    dividend_payout_ratio: float = 30.0
    interest_rate_on_debt: float = 4.0
    # ── Advanced operating ratios (auto-derived, overridable) ──
    dso: float = 45.0
    dio: float = 60.0
    dpo: float = 30.0
    depreciation_rate: float = 8.0

class ComputeForecastPayload(BaseModel):
    inputs: ForecastInputsPayload = ForecastInputsPayload()
    scenarios: list[str] = ["base"]
    forecast_years: int = 5
    # "balanced" → cash/revolver plug forces A = L + E every year.
    # "faithful" → CFS-driven cash; base-year imbalance carries through.
    balance_mode: Literal["balanced", "faithful"] = "balanced"

router = APIRouter()


@router.get("/{project_id}/ratios")
def get_financial_ratios(project_id: str, db: Client = Depends(get_db)):
    """
    Compute and return financial ratios for all available historical years.

    Reads the project's IS + BS JSONB data from Supabase and runs the
    analysis engine (pandas-based) to calculate ratios and YoY % changes.
    """
    project = db.table("projects").select("income_statement, balance_sheet, cash_flow_statement").eq("id", project_id).execute()

    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    pdata = project.data[0]
    result = analysis_engine.compute_ratios(
        income_statement=pdata.get("income_statement"),
        balance_sheet=pdata.get("balance_sheet"),
        cash_flow=pdata.get("cash_flow_statement"),
    )
    return result


@router.get("/{project_id}/horizontal")
def get_horizontal_analysis(project_id: str, db: Client = Depends(get_db)):
    """
    Compute year-over-year percentage changes (horizontal analysis)
    for all line items across the IS and BS.
    """
    project = db.table("projects").select("income_statement, balance_sheet").eq("id", project_id).execute()

    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    pdata = project.data[0]
    result = analysis_engine.compute_horizontal_analysis(
        income_statement=pdata.get("income_statement"),
        balance_sheet=pdata.get("balance_sheet"),
    )
    return result


@router.get("/{project_id}/cashflow")
def get_cash_flow_statement(project_id: str, db: Client = Depends(get_db)):
    """
    Return the stored Cash Flow Statement from the database.
    """
    project = db.table("projects").select("cash_flow_statement").eq("id", project_id).execute()

    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    pdata = project.data[0]
    stored_cf = pdata.get("cash_flow_statement")
    if not stored_cf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cash flow statement not available")
    
    return stored_cf


@router.get("/{project_id}/forecast")
def get_forecast(project_id: str, db: Client = Depends(get_db)):
    """Return the stored 5-year projection data for the project."""
    project = db.table("projects").select("forecast_data").eq("id", project_id).execute()

    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return project.data[0].get("forecast_data", {})


@router.patch("/{project_id}/forecast")
def save_forecast(project_id: str, payload: dict, db: Client = Depends(get_db)):
    """Persist 5-year projection growth rates and computed projections."""
    result = db.table("projects").update({"forecast_data": payload}).eq("id", project_id).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {"status": "saved"}


@router.get("/{project_id}/dcf-metrics")
def get_dcf_base_metrics(project_id: str, db: Client = Depends(get_db)):
    """
    Compute base financial metrics for the DCF Valuation page:
    Base FCF, EBITDA, Net Debt, and historical WACC (using ROE as cost-of-equity proxy).
    Matches the Valuation page's 'Base Financial Metrics & Assumptions' section.
    """
    project = (
        db.table("projects")
        .select("income_statement, balance_sheet, cash_flow_statement, forecast_data")
        .eq("id", project_id)
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    pdata = project.data[0]
    return analysis_engine.compute_dcf_base_metrics(
        income_statement=pdata.get("income_statement"),
        balance_sheet=pdata.get("balance_sheet"),
        cash_flow=pdata.get("cash_flow_statement"),
    )


@router.post("/{project_id}/forecast/compute")
def compute_forecast(
    project_id: str,
    payload: ComputeForecastPayload,
    db: Client = Depends(get_db),
):
    """
    Run the 5-year ForecastingEngine with user-supplied inputs.
    Optionally runs multiple scenarios (base / optimistic / pessimistic).

    Body: {
      inputs:   ForecastInputs dict,
      scenarios: ["base", "optimistic", "pessimistic"]  (optional)
    }

    Returns full IS + BS + CFS projections per year per scenario,
    plus cumulative metrics and balance sheet validation.
    """
    project = (
        db.table("projects")
        .select("income_statement, balance_sheet, cash_flow_statement, dcf_assumptions")
        .eq("id", project_id)
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    pdata = project.data[0]
    result = run_forecast(
        income_statement=pdata.get("income_statement"),
        balance_sheet=pdata.get("balance_sheet"),
        cash_flow=pdata.get("cash_flow_statement"),
        inputs=payload.inputs.model_dump(),
        scenarios=payload.scenarios,
        forecast_years=payload.forecast_years,
        dcf_assumptions=pdata.get("dcf_assumptions"),
        balance_mode=payload.balance_mode,
    )

    # Auto-save the forecast result alongside inputs for persistence
    upd_res = db.table("projects").update({"forecast_data": result}).eq("id", project_id).execute()
    if not upd_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    return result


@router.get("/{project_id}/forecast/assumptions")
def get_historical_assumptions(project_id: str, db: Client = Depends(get_db)):
    """
    Derive suggested ForecastInputs from historical financial statement data.
    Called when the Forecasting page first loads to pre-populate the input form.

    Returns ForecastInputs dict with historically-derived values (CAGR,
    effective tax rate, DSO, DIO, DPO, CapEx%, Depreciation%).
    """
    project = (
        db.table("projects")
        .select("income_statement, balance_sheet")
        .eq("id", project_id)
        .execute()
    )
    if not project.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    from dataclasses import asdict
    pdata = project.data[0]
    assumptions = calculate_historical_assumptions(
        income_statement=pdata.get("income_statement"),
        balance_sheet=pdata.get("balance_sheet"),
    )
    return asdict(assumptions)
