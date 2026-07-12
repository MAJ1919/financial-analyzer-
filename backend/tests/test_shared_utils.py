"""
shared_utils is the single source of truth for the compat key map.
These tests pin its behavior AND guard against the map being re-duplicated
into the engines (the drift that motivated the consolidation).
"""
from app.services import analysis_engine, forecasting_engine, shared_utils
from app.services.shared_utils import _get_compat, _parse_year


class TestParseYear:
    def test_plain_year(self):
        assert _parse_year("2023") == 2023

    def test_fy_two_digit(self):
        assert _parse_year("FY21") == 2021

    def test_embedded_year(self):
        assert _parse_year("Year 2022") == 2022

    def test_no_digits_falls_back(self):
        assert _parse_year("n/a") == 2024


class TestGetCompat:
    def test_direct_hit(self):
        lookup = {"totalRevenue": {"2023": 500.0}}
        assert _get_compat(lookup, "totalRevenue", "2023") == 500.0

    def test_fallback_chain(self):
        # costOfRevenue falls through to manufacturingCostsHeader
        lookup = {"manufacturingCostsHeader": {"2023": 4200.0}}
        assert _get_compat(lookup, "costOfRevenue", "2023") == 4200.0

    def test_first_nonzero_fallback_wins(self):
        lookup = {
            "costOfRevenueDisplayHeader": {"2023": 100.0},
            "manufacturingCostsHeader":   {"2023": 999.0},
        }
        assert _get_compat(lookup, "costOfRevenue", "2023") == 100.0

    def test_depreciation_sum_fallback(self):
        lookup = {
            "depreciationOpex":        {"2023": -30.0},
            "amortizationOpex":        {"2023": 10.0},
            "depreciationCostOfSales": {"2023": -60.0},
        }
        # Summed as absolute values
        assert _get_compat(lookup, "depreciation", "2023") == 100.0

    def test_sga_sum_fallback(self):
        lookup = {
            "totalSellingExpense":      {"2023": 40.0},
            "totalGeneralAdminExpense": {"2023": 60.0},
        }
        assert _get_compat(lookup, "sgaExpense", "2023") == 100.0

    def test_missing_key_returns_zero(self):
        assert _get_compat({}, "totalRevenue", "2023") == 0.0


class TestNoDuplication:
    """If these fail, someone re-copied the helpers into an engine — don't."""

    def test_analysis_engine_uses_shared_get_compat(self):
        assert analysis_engine._get_compat is shared_utils._get_compat

    def test_forecasting_engine_uses_shared_get_compat(self):
        assert forecasting_engine._get_compat is shared_utils._get_compat

    def test_forecasting_engine_uses_shared_parse_year(self):
        assert forecasting_engine._parse_year is shared_utils._parse_year

    def test_analysis_engine_uses_shared_build_lookups(self):
        assert analysis_engine._build_lookups is shared_utils._build_lookups
