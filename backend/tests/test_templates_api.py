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
