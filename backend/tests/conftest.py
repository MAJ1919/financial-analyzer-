"""
Shared fixtures for the backend test suite.

Statement fixtures use the SAME canonical keys the manual-entry template
writes (e.g. `incomeTaxExpense`, not `currentIncomeTax`), so tests exercise
the code paths production data actually takes.
"""
import pytest

from app.services.forecasting_engine import BaseFinancialData


def make_statement(rows: dict[str, dict[str, float]]) -> dict:
    """Build a stored-JSONB-shaped FinancialStatement from {key: {year: value}}."""
    return {
        "rows": [
            {"row_id": key, "key": key, "label": label_for(key), "section": "Test", "values": values}
            for key, values in rows.items()
        ]
    }


# Human-ish labels so horizontal analysis (label-keyed) is testable
_LABELS = {
    "totalRevenue": "Revenue",
    "netIncome": "Net Income",
    "operatingIncome": "Operating Income",
    "financeCosts": "Finance Costs",
    "incomeBeforeTax": "Income Before Tax",
    "incomeTaxExpense": "Income Tax Expense",
}


def label_for(key: str) -> str:
    return _LABELS.get(key, key)


@pytest.fixture
def income_statement() -> dict:
    return make_statement({
        "totalRevenue":     {"2022": 9000.0,  "2023": 10000.0},
        "netIncome":        {"2022": 1000.0,  "2023": 1200.0},
        "operatingIncome":  {"2022": 1800.0,  "2023": 2000.0},
        "financeCosts":     {"2022": 50.0,    "2023": 50.0},
        "incomeBeforeTax":  {"2022": 1400.0,  "2023": 1600.0},
        "incomeTaxExpense": {"2022": 350.0,   "2023": 400.0},
    })


@pytest.fixture
def balance_sheet() -> dict:
    return make_statement({
        "totalAssets":             {"2022": 7500.0, "2023": 8000.0},
        "totalLiabilities":        {"2022": 2800.0, "2023": 3000.0},
        "totalEquity":             {"2022": 4700.0, "2023": 5000.0},
        "totalCurrentAssets":      {"2022": 2600.0, "2023": 3000.0},
        "totalCurrentLiabilities": {"2022": 900.0,  "2023": 1000.0},
        "cashAndEquivalents":      {"2022": 400.0,  "2023": 500.0},
        "ltDebtData":              {"2022": 1000.0, "2023": 1000.0},
        "retainedEarnings":        {"2022": 2000.0, "2023": 2500.0},
    })


@pytest.fixture
def base_balanced() -> BaseFinancialData:
    """Base-year data where A = L + E exactly (15,000 = 6,000 + 9,000)."""
    return BaseFinancialData(
        revenue=10_000.0, cost_of_revenue=5_500.0, operating_income=2_500.0,
        net_income=1_800.0, depreciation=400.0,
        total_assets=15_000.0, total_liabilities=6_000.0, total_equity=9_000.0,
        current_assets=6_000.0, current_liabilities=2_500.0,
        long_term_debt=2_000.0, retained_earnings=6_000.0,
        ppe=9_000.0, accumulated_depreciation=2_000.0,
        inventory=1_200.0, accounts_receivable=1_300.0, accounts_payable=900.0,
        cash=2_800.0, last_year=2023, operating_margin=25.0,
    )
