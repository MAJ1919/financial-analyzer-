"""
Golden-value tests for the analysis engine.

Fixture data (see conftest): revenue 10,000, NI 1,200, equity 5,000,
LT debt 1,000, cash 500 in 2023 — all goldens below derive by hand.
"""
import pytest

from app.services.analysis_engine import (
    compute_ratios,
    compute_horizontal_analysis,
    compute_dcf_base_metrics,
)
from app.models.financial import statement_to_lookup, label_to_key
from conftest import make_statement


class TestComputeRatios:
    def test_years_detected(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        assert r["years"] == ["2022", "2023"]

    def test_roe(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        # 1,200 / 5,000
        assert r["ratios"]["Profitability"]["roe"]["2023"] == pytest.approx(0.24)

    def test_current_ratio(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        # 3,000 / 1,000
        assert r["ratios"]["Liquidity"]["currentRatio"]["2023"] == pytest.approx(3.0)

    def test_net_profit_margin(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        assert r["ratios"]["Profitability"]["netProfitMargin"]["2023"] == pytest.approx(0.12)

    def test_debt_to_equity(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        # total liabilities / total equity = 3,000 / 5,000
        assert r["ratios"]["Solvency"]["debtToEquity"]["2023"] == pytest.approx(0.6)

    def test_asset_turnover_uses_average_assets(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        # 10,000 / ((7,500 + 8,000) / 2)
        assert r["ratios"]["Efficiency"]["assetTurnover"]["2023"] == pytest.approx(10000 / 7750, abs=1e-4)

    def test_interest_coverage(self, income_statement, balance_sheet):
        r = compute_ratios(income_statement, balance_sheet)
        # operating income / |finance costs| = 2,000 / 50
        assert r["ratios"]["Coverage"]["interestCoverage"]["2023"] == pytest.approx(40.0)

    def test_empty_input(self):
        r = compute_ratios(None, None)
        assert r["years"] == [] and r["ratios"] == {}

    def test_current_portion_lt_debt_not_double_counted(self):
        """Regression: `currentDebt` is a compat ALIAS for `currentPortionLTDebt`.

        Summing both counted the current portion twice and inflated every
        debt-based ratio (same class of bug as cost-of-debt below).
        """
        bs = make_statement({
            "totalAssets":          {"2023": 10_000.0},
            "totalEquity":          {"2023": 5_000.0},
            "cashAndEquivalents":   {"2023": 0.0},
            "stBorrowingsData":     {"2023": 100.0},
            "currentPortionLTDebt": {"2023": 400.0},
            "ltDebtData":           {"2023": 1_500.0},
        })
        r = compute_ratios(make_statement({"totalRevenue": {"2023": 1.0}}), bs)
        # total debt = 100 + 400 + 1,500 = 2,000 (NOT 2,400)
        assert r["ratios"]["Solvency"]["debtToAssets"]["2023"] == pytest.approx(0.20)
        assert r["ratios"]["Solvency"]["debtToCapital"]["2023"] == pytest.approx(2000 / 7000)

    def test_dividend_payout_ratio_uses_dividends_actually_paid(self):
        """Regression: payout read a `commonStockDividendPerShare` key that no
        template row and no compat alias ever populates, so it was always 0."""
        inc = make_statement({"totalRevenue": {"2023": 1.0}, "netIncome": {"2023": 1_000.0}})
        cf = make_statement({"cfDividendsPaid": {"2023": 400.0}})
        r = compute_ratios(inc, make_statement({"totalEquity": {"2023": 1.0}}), cf)
        assert r["ratios"]["Per Share"]["dividendPayoutRatio"]["2023"] == pytest.approx(0.40)

    def test_ev_to_ebitda_is_none_without_market_cap(self):
        """Nothing supplies a share price, so EV collapses to net debt. Report
        nothing rather than a plausible-looking wrong multiple."""
        inc = make_statement({"totalRevenue": {"2023": 1.0}, "operatingIncome": {"2023": 500.0}})
        bs = make_statement({"ltDebtData": {"2023": 1_000.0}, "totalEquity": {"2023": 1.0}})
        r = compute_ratios(inc, bs)
        assert r["ratios"]["Market"]["evToEbitda"]["2023"] is None


class TestHorizontalAnalysis:
    def test_revenue_yoy(self, income_statement, balance_sheet):
        h = compute_horizontal_analysis(income_statement, balance_sheet)
        # (10,000 − 9,000) / 9,000
        assert h["income_statement"]["Revenue"]["2022 vs 2023"] == pytest.approx(1 / 9, abs=1e-4)

    def test_single_year_yields_empty(self, income_statement):
        one_year = {"rows": [{"key": "totalRevenue", "label": "Revenue", "values": {"2023": 100}}]}
        h = compute_horizontal_analysis(one_year, None)
        assert h["income_statement"] == {}


class TestDcfBaseMetrics:
    def test_golden_values(self, income_statement, balance_sheet):
        m = compute_dcf_base_metrics(income_statement, balance_sheet)
        assert m["latest_year"] == "2023"
        assert m["tax_rate"] == pytest.approx(0.25)          # 400 / 1,600
        assert m["net_debt"] == pytest.approx(500.0)         # 1,000 debt − 500 cash
        assert m["ebitda"] == pytest.approx(2000.0)          # op income, no D&A in fixture
        # Base FCF = NOPAT 1,500 + D&A 0 − capex 0 − ΔWC 300
        assert m["base_fcf"] == pytest.approx(1200.0)

    def test_cost_of_debt_not_double_counted(self, income_statement, balance_sheet):
        """Regression: interest expense was summed with itself, doubling cost of debt."""
        m = compute_dcf_base_metrics(income_statement, balance_sheet)
        pretax_cod = m["wacc"]["cost_of_debt"] / (1 - m["tax_rate"])
        # financeCosts 50 / total debt 1,000 = 5.0% pre-tax
        assert pretax_cod == pytest.approx(5.0, abs=0.01)

    def test_wacc_composition(self, income_statement, balance_sheet):
        m = compute_dcf_base_metrics(income_statement, balance_sheet)
        # (5/6 × 24%) + (1/6 × 3.75%) = 20.625%
        assert m["wacc"]["historical_wacc"] == pytest.approx(20.625, abs=0.01)

    def test_empty_input(self):
        assert compute_dcf_base_metrics(None, None) == {}


class TestModels:
    def test_statement_to_lookup_prefers_stored_key(self):
        stmt = {"rows": [{"key": "totalRevenue", "label": "Whatever Label", "values": {"2023": 5}}]}
        assert statement_to_lookup(stmt) == {"totalRevenue": {"2023": 5.0}}

    def test_statement_to_lookup_none_values_become_zero(self):
        stmt = {"rows": [{"key": "x", "label": "x", "values": {"2023": None}}]}
        assert statement_to_lookup(stmt)["x"]["2023"] == 0.0

    def test_label_to_key_known_and_unknown(self):
        assert label_to_key("Total Revenue") == "totalRevenue"
        assert label_to_key("Unknown Thing") == "Unknown Thing"
