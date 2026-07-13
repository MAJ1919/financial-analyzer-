"""
GET /api/templates/statements — the frontend initializes manual entry from
this endpoint, so its shape is a hard contract.
"""
from fastapi.testclient import TestClient

from app.main import app
from app.models.statement_templates import load_statement_templates

client = TestClient(app)


def test_returns_all_three_statements():
    res = client.get("/api/templates/statements")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"income_statement", "balance_sheet", "cash_flow_statement"}


def test_matches_canonical_template():
    body = client.get("/api/templates/statements").json()
    template = load_statement_templates()
    for stmt_type, rows in template.items():
        assert len(body[stmt_type]) == len(rows)


def test_rows_carry_required_fields():
    body = client.get("/api/templates/statements").json()
    for rows in body.values():
        for row in rows:
            assert row["key"] and row["label"] is not None
            assert "section" in row and "level" in row


def test_no_redundant_aggregate_rows():
    """Aggregates live in the computed header rows (Revenue, Assets, ...) —
    standalone 'Total X' duplicates must not creep back into the template."""
    deprecated = {
        "totalRevenue", "totalCostOfRevenue", "totalSellingExpense",
        "totalGeneralAdminExpense", "totalOtherOperatingExpense",
        "operatingIncomeDisplayHeader",
        "netReceivables", "totalInventory", "totalCurrentAssets", "netPPE",
        "netIntangibleAssets", "totalNonCurrentAssets", "totalAssets",
        "totalCurrentLiabilities", "totalNonCurrentLiabilities",
        "totalLiabilities", "totalEquity",
        "operatingCashFlow", "investingCashFlow", "financingCashFlow",
        "totalNonCashAdjustments", "totalWorkingCapitalAdjustments",
    }
    body = client.get("/api/templates/statements").json()
    present = {row["key"] for rows in body.values() for row in rows}
    assert not (present & deprecated), f"redundant rows back in template: {present & deprecated}"
