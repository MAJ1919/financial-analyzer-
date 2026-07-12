"""
Forecasting engine invariants — the contracts the UI depends on:

  balanced mode  → A = L + E FORCED every year (cash/revolver plug),
                   even when the input balance sheet doesn't reconcile.
  faithful mode  → cash is CFS-driven; the base-year imbalance (if any)
                   carries through every forecast year EXACTLY.
"""
import dataclasses

import pytest

from app.services.forecasting_engine import (
    BaseFinancialData,
    ForecastInputs,
    ForecastScenario,
    ForecastingEngine,
    run_forecast,
    calculate_historical_assumptions,
)


def identity_diffs(forecasts):
    """A − (L + E) per year, rounded to cents."""
    return [round(f.total_assets - (f.total_liabilities + f.total_equity), 2) for f in forecasts]


# Stored fields are individually rounded to 2dp → allow a few cents of noise.
ROUNDING = 0.05


@pytest.fixture
def base_imbalanced(base_balanced):
    """Assets overstated by exactly +500 vs L + E."""
    return dataclasses.replace(base_balanced, total_assets=15_500.0)


class TestFaithfulMode:
    def test_balanced_input_stays_balanced(self, base_balanced):
        eng = ForecastingEngine(base_balanced, ForecastInputs(), 5, balance_mode="faithful")
        assert all(abs(d) <= ROUNDING for d in identity_diffs(eng.generate_forecast()))

    def test_imbalance_carries_through_exactly(self, base_imbalanced):
        eng = ForecastingEngine(base_imbalanced, ForecastInputs(), 5, balance_mode="faithful")
        diffs = identity_diffs(eng.generate_forecast())
        assert all(abs(d - 500.0) <= ROUNDING for d in diffs), diffs

    def test_cash_follows_cfs(self, base_balanced):
        eng = ForecastingEngine(base_balanced, ForecastInputs(), 5, balance_mode="faithful")
        prev_cash = base_balanced.cash
        for f in eng.generate_forecast():
            expected = prev_cash + f.operating_cash_flow + f.investing_cash_flow + f.financing_cash_flow
            assert f.cash == pytest.approx(expected, abs=ROUNDING)
            prev_cash = f.cash

    def test_no_revolver_or_fabricated_flows(self, base_balanced):
        eng = ForecastingEngine(base_balanced, ForecastInputs(), 3, balance_mode="faithful")
        for f in eng.generate_forecast():
            assert f.revolver == 0.0
            assert f.stock_based_comp == 0.0
            assert f.acquisitions == 0.0
            assert f.debt_issuance == 0.0


class TestBalancedMode:
    def test_balances_even_with_bad_input(self, base_imbalanced):
        eng = ForecastingEngine(base_imbalanced, ForecastInputs(), 5, balance_mode="balanced")
        checks = eng.validate_balance_sheet(eng.generate_forecast())
        assert all(c["balanced"] for c in checks)

    def test_revolver_draws_under_stress_and_still_balances(self, base_balanced):
        stress_inputs = ForecastInputs(
            revenue_growth_rate=25.0, capex_as_pct_of_revenue=15.0,
            dso=90.0, dio=120.0, dpo=10.0,
            dividend_payout_ratio=95.0, interest_rate_on_debt=8.0,
            depreciation_rate=2.0,
        )
        stress_base = dataclasses.replace(
            base_balanced, operating_income=300.0, net_income=100.0,
            cash=50.0, total_equity=2_000.0, retained_earnings=500.0,
        )
        eng = ForecastingEngine(stress_base, stress_inputs, 5, balance_mode="balanced")
        forecasts = eng.generate_forecast()
        assert any(f.revolver > 0 for f in forecasts)
        assert all(f.cash >= 0 for f in forecasts)
        assert all(c["balanced"] for c in eng.validate_balance_sheet(forecasts))
        # Revolver sits inside current liabilities
        for f in forecasts:
            assert f.total_current_liabilities == pytest.approx(
                f.accounts_payable + f.other_current_liabilities + f.revolver, abs=ROUNDING
            )

    def test_healthy_company_never_draws_revolver(self, base_balanced):
        eng = ForecastingEngine(base_balanced, ForecastInputs(), 5, balance_mode="balanced")
        assert all(f.revolver == 0 for f in eng.generate_forecast())

    def test_dividends_never_negative(self, base_balanced):
        loss_base = dataclasses.replace(base_balanced, operating_income=-2_000.0, net_income=-2_500.0)
        eng = ForecastingEngine(loss_base, ForecastInputs(dividend_payout_ratio=50.0), 3)
        assert all(f.dividends_paid >= 0 for f in eng.generate_forecast())


class TestPpeRollForward:
    def test_gross_ppe_grows_by_capex_only(self, base_balanced):
        """Regression: net PPE used to shrink by depreciation twice per year."""
        eng = ForecastingEngine(base_balanced, ForecastInputs(), 2, balance_mode="faithful")
        f1, f2 = eng.generate_forecast()
        assert f1.ppe == pytest.approx(base_balanced.ppe + f1.capex, abs=ROUNDING)
        assert f2.ppe == pytest.approx(f1.ppe + f2.capex, abs=ROUNDING)
        assert f1.accumulated_depreciation == pytest.approx(
            base_balanced.accumulated_depreciation + f1.depreciation, abs=ROUNDING
        )


class TestPerYearGrowth:
    def test_rates_apply_year_by_year(self, base_balanced):
        rates = [20.0, 10.0, 5.0, 0.0, -5.0]
        eng = ForecastingEngine(
            base_balanced, ForecastInputs(revenue_growth_rates=rates), 5, balance_mode="faithful"
        )
        expected, r = [], base_balanced.revenue
        for g in rates:
            r *= 1 + g / 100
            expected.append(round(r, 2))
        assert [f.revenue for f in eng.generate_forecast()] == expected

    def test_short_list_carries_last_rate(self):
        inputs = ForecastInputs(revenue_growth_rates=[10.0, 2.0])
        assert inputs.growth_for_year(0) == 10.0
        assert inputs.growth_for_year(1) == 2.0
        assert inputs.growth_for_year(4) == 2.0

    def test_flat_rate_when_no_list(self):
        assert ForecastInputs(revenue_growth_rate=7.5).growth_for_year(3) == 7.5

    def test_scenario_multiplier_applies_per_year(self, base_balanced):
        eng = ForecastingEngine(
            base_balanced, ForecastInputs(revenue_growth_rates=[20.0]), 1, balance_mode="faithful"
        )
        f = eng.generate_forecast(ForecastScenario("pessimistic", 0.7))[0]
        # 10,000 × (1 + 0.20 × 0.7)
        assert f.revenue == pytest.approx(11_400.0)


class TestRunForecastPipeline:
    def test_response_shape_and_mode(self, income_statement, balance_sheet):
        res = run_forecast(
            income_statement, balance_sheet, None,
            inputs={"revenue_growth_rates": [12, 8, 5]},
            scenarios=["base", "pessimistic"],
            balance_mode="faithful",
        )
        assert res["balance_mode"] == "faithful"
        assert set(res["scenarios"]) == {"base", "pessimistic"}
        assert res["inputs"]["revenue_growth_rates"] == [12.0, 8.0, 5.0]

    def test_base_imbalance_reported(self, income_statement, balance_sheet):
        # Fixture BS: 8,000 = 3,000 + 5,000 → balanced
        res = run_forecast(income_statement, balance_sheet, None, inputs={})
        assert res["base_imbalance"] == 0.0

    def test_invalid_mode_falls_back_to_balanced(self, income_statement, balance_sheet):
        res = run_forecast(income_statement, balance_sheet, None, inputs={}, balance_mode="nonsense")
        assert res["balance_mode"] == "balanced"

    def test_projected_statements_carry_engine_overrides(self, income_statement, balance_sheet):
        res = run_forecast(income_statement, balance_sheet, None, inputs={})
        first = res["scenarios"]["base"]["forecasts"][0]
        assert first["full_income_statement"]["netIncome"] == first["net_income"]

    def test_cumulative_metrics_present(self, income_statement, balance_sheet):
        res = run_forecast(income_statement, balance_sheet, None, inputs={})
        cm = res["scenarios"]["base"]["cumulative_metrics"]
        assert cm["total_revenue"] > 0 and "revenue_cagr" in cm


class TestHistoricalAssumptions:
    def test_derived_and_default_values(self, income_statement, balance_sheet):
        a = calculate_historical_assumptions(income_statement, balance_sheet)
        assert a.revenue_growth_rate == pytest.approx(11.1, abs=0.05)  # 9,000 → 10,000
        assert a.tax_rate == pytest.approx(25.0, abs=0.1)              # 400 / 1,600
        # No AR/inventory/payables in fixture → documented defaults
        assert (a.dso, a.dio, a.dpo) == (45.0, 60.0, 30.0)

    def test_insufficient_data_returns_defaults(self):
        a = calculate_historical_assumptions(None, None)
        assert a == ForecastInputs()
