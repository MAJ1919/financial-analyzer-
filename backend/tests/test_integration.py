import os
import io
import openpyxl
import pytest

from app.services.excel_parser import parse_and_suggest_mapping, normalize_confirmed_mapping
from app.services.analysis_engine import compute_ratios, compute_horizontal_analysis, derive_cash_flow_statement, compute_dcf_base_metrics
from app.services.forecasting_engine import run_forecast
from app.models.financial import MappingConfirmation

def create_test_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Financials"

    # Headers
    ws.append(["Line Items", "2021", "2022", "2023"])

    # Income Statement
    ws.append(["Revenue", 10000, 11000, 12000])
    ws.append(["Cost of Goods Sold", 4000, 4500, 5000])
    ws.append(["Operating Expenses", 2000, 2200, 2500])
    ws.append(["EBITDA", 4000, 4300, 4500])
    ws.append(["Interest Expense", 500, 500, 500])
    ws.append(["Net Income", 2500, 2800, 3000])

    # Balance Sheet
    ws.append(["Cash", 5000, 6000, 7000])
    ws.append(["Accounts Receivable", 1000, 1200, 1300])
    ws.append(["Inventory", 800, 900, 1000])
    ws.append(["Total Current Assets", 6800, 8100, 9300])
    ws.append(["Total Assets", 20000, 22000, 24000])
    
    ws.append(["Accounts Payable", 1000, 1100, 1200])
    ws.append(["Total Current Liabilities", 1000, 1100, 1200])
    ws.append(["Long-term Debt", 5000, 5000, 4500])
    ws.append(["Total Liabilities", 6000, 6100, 5700])
    ws.append(["Total Equity", 14000, 15900, 18300])

    # Save to bytes
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def test_end_to_end_flow():
    # 1. Excel Upload Parsing
    file_bytes = create_test_excel()
    parsed_data = parse_and_suggest_mapping(file_bytes)
    
    assert "years" in parsed_data
    assert "rows" in parsed_data
    assert "raw_values" in parsed_data
    
    years = parsed_data["years"]
    rows = parsed_data["rows"]
    raw_values = parsed_data["raw_values"]
    
    # Split into IS and BS confirmation payloads
    is_rows = []
    is_raw_values = []
    bs_rows = []
    bs_raw_values = []
    
    for i, row in enumerate(rows):
        if row.statement_type == "income_statement":
            row.accepted = True
            is_rows.append(row)
            is_raw_values.append(raw_values[i])
        elif row.statement_type == "balance_sheet":
            row.accepted = True
            bs_rows.append(row)
            bs_raw_values.append(raw_values[i])
            
    is_confirmation = MappingConfirmation(
        statement_type="income_statement",
        years=years,
        rows=is_rows,
        raw_values=is_raw_values
    )
    
    bs_confirmation = MappingConfirmation(
        statement_type="balance_sheet",
        years=years,
        rows=bs_rows,
        raw_values=bs_raw_values
    )
    
    is_normalized = normalize_confirmed_mapping(is_confirmation)
    bs_normalized = normalize_confirmed_mapping(bs_confirmation)
    
    assert "income_statement" in is_normalized
    assert "balance_sheet" in bs_normalized
    
    income_statement = is_normalized["income_statement"]
    balance_sheet = bs_normalized["balance_sheet"]
    
    # 2. Analysis Engine
    
    # Ratios
    ratios_result = compute_ratios(income_statement, balance_sheet)
    assert ratios_result["years"] == years
    assert "Liquidity" in ratios_result["ratios"]
    
    # Horizontal Analysis
    horizontal_result = compute_horizontal_analysis(income_statement, balance_sheet)
    assert "income_statement" in horizontal_result
    assert "balance_sheet" in horizontal_result
    
    # Cash Flow Statement Derivation
    cf_result = derive_cash_flow_statement(income_statement, balance_sheet)
    assert "operating" in cf_result
    
    # The derived cash flow doesn't match the FinancialStatement layout 1:1,
    # but the compute_ratios function expects a FinancialStatement if provided.
    # We will pass None as it gracefully handles missing CFS.
    
    # DCF Base Metrics
    dcf_metrics = compute_dcf_base_metrics(income_statement, balance_sheet)
    assert "base_fcf" in dcf_metrics
    
    # 3. Forecasting Engine
    forecast_inputs = {
        "revenue_growth_rate": 5.0,
        "operating_margin_expansion": 0.5,
        "capex_as_pct_of_revenue": 2.0,
    }
    
    forecast_result = run_forecast(
        income_statement=income_statement,
        balance_sheet=balance_sheet,
        cash_flow=None,
        inputs=forecast_inputs,
        scenarios=["base", "optimistic"],
        forecast_years=5
    )
    
    assert "base" in forecast_result["scenarios"]
    assert "optimistic" in forecast_result["scenarios"]
    assert len(forecast_result["scenarios"]["base"]["forecasts"]) == 5
    
    print("Integration test passed successfully!")

if __name__ == "__main__":
    test_end_to_end_flow()
