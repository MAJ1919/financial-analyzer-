"""
Excel parser round-trip tests.

The parser is STRICT-TEMPLATE: sheet names and row labels must match
manualEntryTemplate.json exactly. Tests build workbooks in memory using
labels pulled from the real template, so they stay valid if labels change.
"""
import datetime
import io

import openpyxl
import pytest

from app.services.excel_parser import (
    LEGACY_LABEL_ALIASES,
    TEMPLATE_DATA,
    parse_template_upload,
    _clean_numeric_value,
    _extract_year_from_cell,
)


def build_workbook(sheets: dict[str, list[list]]) -> bytes:
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(title=name)
        for row in rows:
            ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def leaf_labels(stmt_type: str, n: int) -> list[str]:
    """First n editable (non-header, non-subtotal) labels from the real template."""
    labels = [
        r["label"] for r in TEMPLATE_DATA[stmt_type]
        if not r.get("is_header") and not r.get("is_subtotal") and r.get("label")
    ]
    assert len(labels) >= n, f"template too small for test: {stmt_type}"
    return labels[:n]


def rows_by_key(statement: dict) -> dict:
    return {r["key"]: r for r in statement["rows"]}


class TestParseTemplateUpload:
    def test_round_trip_values_land_on_template_keys(self):
        l1, l2 = leaf_labels("income_statement", 2)
        content = build_workbook({
            "Income Statement": [
                ["Line Items", 2022, 2023],
                [l1, 100, 200],
                [l2, "1,500", "(250)"],   # thousands separator + accounting negative
            ],
        })
        result = parse_template_upload(content)
        stmt = result["income_statement"]
        assert stmt["years"] == ["2022", "2023"]

        by_label = {r["label"]: r for r in stmt["rows"]}
        assert by_label[l1]["values"] == {"2022": 100.0, "2023": 200.0}
        assert by_label[l2]["values"] == {"2022": 1500.0, "2023": -250.0}

    def test_all_three_statements_always_present(self):
        (l1,) = leaf_labels("income_statement", 1)
        content = build_workbook({
            "Income Statement": [["Line Items", 2023], [l1, 10]],
        })
        result = parse_template_upload(content)
        for stmt_type in ("income_statement", "balance_sheet", "cash_flow_statement"):
            assert stmt_type in result
            assert len(result[stmt_type]["rows"]) == len(TEMPLATE_DATA[stmt_type])

    def test_unknown_labels_reported_as_unmapped(self):
        (l1,) = leaf_labels("income_statement", 1)
        content = build_workbook({
            "Income Statement": [
                ["Line Items", 2023],
                [l1, 10],
                ["Totally Unknown Line Item", 99],
            ],
        })
        result = parse_template_upload(content)
        assert "Totally Unknown Line Item" in result["unmapped_rows"]["Income Statement"]

    def test_labels_missing_from_excel_get_none_values(self):
        l1, l2 = leaf_labels("income_statement", 2)
        content = build_workbook({
            "Income Statement": [["Line Items", 2023], [l1, 10]],
        })
        by_label = {r["label"]: r for r in parse_template_upload(content)["income_statement"]["rows"]}
        assert by_label[l2]["values"] == {"2023": None}

    def test_no_year_headers_raises(self):
        content = build_workbook({
            "Income Statement": [["Line Items", "First", "Second"], ["Revenue", 1, 2]],
        })
        with pytest.raises(ValueError, match="year column headers"):
            parse_template_upload(content)

    def test_non_template_sheet_names_are_skipped(self):
        content = build_workbook({
            "My Custom Sheet": [["Line Items", 2023], ["Revenue", 10]],
        })
        result = parse_template_upload(content)
        # Years were found, so empty template statements are still returned
        assert all(
            v is None
            for r in result["income_statement"]["rows"]
            for v in r["values"].values()
        )

    def test_fy_prefixed_year_headers(self):
        (l1,) = leaf_labels("income_statement", 1)
        content = build_workbook({
            "Income Statement": [["Line Items", "FY2022", "FY2023"], [l1, 1, 2]],
        })
        assert parse_template_upload(content)["income_statement"]["years"] == ["2022", "2023"]

    def test_cfs_derived_from_bs_when_absent(self):
        """With no CFS sheet, capex is derived from the gross PP&E delta."""
        template_bs = {r["key"]: r for r in TEMPLATE_DATA["balance_sheet"]}
        if "grossPPE" not in template_bs:
            pytest.skip("template has no grossPPE row")
        ppe_label = template_bs["grossPPE"]["label"]

        (is_label,) = leaf_labels("income_statement", 1)
        content = build_workbook({
            "Income Statement": [["Line Items", 2022, 2023], [is_label, 1, 2]],
            "Balance Sheet":    [["Line Items", 2022, 2023], [ppe_label, 1000, 1500]],
        })
        cfs = rows_by_key(parse_template_upload(content)["cash_flow_statement"])
        # CapEx = −(ΔGross PPE) = −500
        assert cfs["capitalExpenditures"]["values"]["2023"] == pytest.approx(-500.0)


class TestLegacyLabelAliases:
    """Workbooks downloaded before the template was regenerated still carry the
    labels this project shipped back then. Re-downloading a blank template is
    not a remedy — it discards everything the user entered."""

    def test_alias_map_targets_are_real_canonical_labels(self):
        """An alias pointing at a label the template no longer has is dead
        config that would silently never fire."""
        all_labels = {
            r["label"].strip()
            for rows in TEMPLATE_DATA.values()
            for r in rows
            if r.get("label")
        }
        for legacy, canonical in LEGACY_LABEL_ALIASES.items():
            assert canonical in all_labels, f"alias target not in template: {canonical}"
            assert legacy == legacy.lower(), f"alias key must be lowercased: {legacy}"
            assert legacy not in {lbl.lower() for lbl in all_labels}, (
                f"{legacy!r} is still a live canonical label — aliasing it would "
                f"shadow the real row"
            )

    def test_legacy_label_lands_on_the_canonical_row(self):
        content = build_workbook({
            "Income Statement": [
                ["Line Item", 2023],
                ["Operating Income", 4200],      # label from the pre-regeneration template
            ],
        })
        result = parse_template_upload(content)
        rows = rows_by_key(result["income_statement"])
        assert rows["operatingIncome"]["values"]["2023"] == 4200.0
        assert result["unmapped_rows"] == {}

    def test_canonical_row_wins_over_legacy_duplicate(self):
        """A part-migrated workbook holding both labels must not have its
        current row overwritten by the stale one."""
        content = build_workbook({
            "Income Statement": [
                ["Line Item", 2023],
                ["Operating Income (EBIT)", 999],
                ["Operating Income", 111],
            ],
        })
        result = parse_template_upload(content)
        rows = rows_by_key(result["income_statement"])
        assert rows["operatingIncome"]["values"]["2023"] == 999.0
        # The stale row was not consumed, so it is reported rather than dropped.
        assert "Operating Income" in result["unmapped_rows"]["Income Statement"]


class TestUnmappedHints:
    def test_near_miss_label_gets_a_did_you_mean_hint(self):
        content = build_workbook({
            "Income Statement": [
                ["Line Item", 2023],
                ["Operating Income (EBITDA)", 10],   # close to a real label
            ],
        })
        result = parse_template_upload(content)
        hint = result["unmapped_hints"]["Income Statement"]["Operating Income (EBITDA)"]
        assert "Operating Income (EBIT)" in hint

    def test_unrecognisable_label_gets_no_guess(self):
        content = build_workbook({
            "Income Statement": [
                ["Line Item", 2023],
                ["Zzzz Qqqq Wholly Unrelated", 10],
            ],
        })
        result = parse_template_upload(content)
        assert "Zzzz Qqqq Wholly Unrelated" in result["unmapped_rows"]["Income Statement"]
        assert "Zzzz Qqqq Wholly Unrelated" not in result["unmapped_hints"].get("Income Statement", {})

    def test_duplicate_rows_are_reported_not_silently_dropped(self):
        l1, l2 = leaf_labels("income_statement", 2)
        content = build_workbook({
            "Income Statement": [
                ["Line Item", 2023],
                [l1, 10],
                [l2, 20],
                [l1, 99],       # duplicate of the first row
            ],
        })
        result = parse_template_upload(content)
        rows = {r["label"]: r for r in result["income_statement"]["rows"]}
        assert rows[l1]["values"]["2023"] == 10.0        # first occurrence wins
        assert l1 in result["unmapped_rows"]["Income Statement"]
        assert "Duplicate" in result["unmapped_hints"]["Income Statement"][l1]


class TestCleanNumericValue:
    @pytest.mark.parametrize("raw, expected", [
        ("1,234", 1234.0),
        ("(500)", -500.0),
        (" 42 ", 42.0),
        (7, 7.0),
        (3.5, 3.5),
        ("abc", None),
        (None, None),
        (float("nan"), None),
        (float("inf"), None),
    ])
    def test_cases(self, raw, expected):
        assert _clean_numeric_value(raw) == expected


class TestExtractYear:
    @pytest.mark.parametrize("raw, expected", [
        ("2023", "2023"),
        ("FY2023", "2023"),
        ("2023A", "2023"),
        ("fy2021", "2021"),
        (datetime.datetime(2022, 6, 1), "2022"),
        # Numeric cells — Excel stores a typed "2022" as a number
        (2023, "2023"),
        (2023.0, "2023"),
        (2023.5, None),
        (True, None),
        ("Q1 2023", None),   # strict full-match only
        ("1850", None),      # outside 19xx/20xx
        ("notayear", None),
        (None, None),
        (12, None),
    ])
    def test_cases(self, raw, expected):
        assert _extract_year_from_cell(raw) == expected
