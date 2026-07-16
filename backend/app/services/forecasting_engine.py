"""
Forecasting Engine Service
==========================
Complete 5-year financial forecast generator — Python port of forecastingEngine.ts.

Produces projected Income Statement, Balance Sheet, and Cash Flow Statement
for each forecast year, plus cumulative metrics and balance sheet validation.

All arithmetic is in Python, as required by SRS §2.5.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Literal

from app.models.financial import statement_to_lookup
# Shared helpers — the compat key mapping is maintained ONLY in shared_utils
# (also used by analysis_engine, keeping ratios and forecasts consistent).
from app.services.shared_utils import _get_compat, _parse_year

# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ForecastInputs:
    """
    Forecast assumptions, split in two tiers:

    CORE (user-facing form):
      revenue_growth_rate / revenue_growth_rates, tax_rate,
      capex_as_pct_of_revenue, dividend_payout_ratio, interest_rate_on_debt.

    ADVANCED (auto-derived from historicals, overridable in the UI):
      dso, dio, dpo, depreciation_rate — these are operating RATIOS, not
      true assumptions, so they default from calculate_historical_assumptions().

    Removed (dead/redundant knobs):
      operating_margin_expansion — margin is an OUTPUT of the cost structure
      working_capital_change     — WC now derived from actual DSO/DIO/DPO deltas
      share_repurchase_rate      — no share-count model existed to support it
    """
    # ── Core assumptions ────────────────────────────────────
    revenue_growth_rate: float          = 0.0   # % per year (single rate for all years)
    revenue_growth_rates: list[float] | None = None  # optional per-year override, e.g. [12, 10, 8, 6, 5]
    tax_rate: float                     = 25.0   # %
    capex_as_pct_of_revenue: float      = 3.0    # % of revenue
    dividend_payout_ratio: float        = 30.0   # % of net income
    interest_rate_on_debt: float        = 4.0    # % on debt balance

    # ── Advanced operating ratios (auto-derived, overridable) ──
    dso: float                          = 45.0   # Days Sales Outstanding
    dio: float                          = 60.0   # Days Inventory Outstanding
    dpo: float                          = 30.0   # Days Payable Outstanding
    depreciation_rate: float            = 8.0    # % of revenue

    def growth_for_year(self, idx: int) -> float:
        """Growth rate (%) for forecast year `idx` (0-based).

        Per-year list wins when provided; if it's shorter than the horizon,
        the last entry carries forward for the remaining years.
        """
        if self.revenue_growth_rates:
            return float(self.revenue_growth_rates[min(idx, len(self.revenue_growth_rates) - 1)])
        return self.revenue_growth_rate


@dataclass
class BaseFinancialData:
    # Income Statement
    revenue: float                  = 0.0
    cost_of_revenue: float          = 0.0
    gross_profit: float             = 0.0
    operating_income: float         = 0.0
    net_income: float               = 0.0
    depreciation: float             = 0.0
    interest_expense: float         = 0.0
    tax_expense: float              = 0.0
    ebitda: float                   = 0.0

    # Balance Sheet
    total_assets: float             = 0.0
    total_liabilities: float        = 0.0
    total_equity: float             = 0.0
    current_assets: float           = 0.0
    current_liabilities: float      = 0.0
    long_term_debt: float           = 0.0
    retained_earnings: float        = 0.0
    ppe: float                      = 0.0
    accumulated_depreciation: float = 0.0
    inventory: float                = 0.0
    accounts_receivable: float      = 0.0
    accounts_payable: float         = 0.0
    cash: float                     = 0.0
    shares_outstanding: float       = 0.0

    # Cash Flow
    operating_cash_flow: float      = 0.0
    capital_expenditure: float      = 0.0
    free_cash_flow: float           = 0.0

    # Metadata
    last_year: int                  = 0
    operating_margin: float         = 0.0


@dataclass
class ForecastScenario:
    scenario: Literal['base', 'optimistic', 'pessimistic'] = 'base'
    revenue_growth_multiplier: float      = 1.0   # applied to each year's growth rate


@dataclass
class YearlyForecast:
    year: int

    # ── Income Statement
    revenue: float                  = 0.0
    cost_of_revenue: float          = 0.0
    gross_profit: float             = 0.0
    sga_expenses: float             = 0.0
    rd_expenses: float              = 0.0
    depreciation: float             = 0.0
    total_op_expenses: float        = 0.0
    operating_income: float         = 0.0
    interest_income: float          = 0.0
    interest_expense: float         = 0.0
    income_before_tax: float        = 0.0
    tax_expense: float              = 0.0
    net_income: float               = 0.0
    ebitda: float                   = 0.0

    # ── Balance Sheet
    cash: float                         = 0.0
    accounts_receivable: float          = 0.0
    inventory: float                    = 0.0
    other_current_assets: float         = 0.0
    total_current_assets: float         = 0.0
    ppe: float                          = 0.0
    accumulated_depreciation: float     = 0.0
    goodwill: float                     = 0.0
    other_intangibles: float            = 0.0
    total_assets: float                 = 0.0
    accounts_payable: float             = 0.0
    other_current_liabilities: float    = 0.0
    revolver: float                     = 0.0   # short-term borrowing plug (drawn when cash would go negative)
    total_current_liabilities: float    = 0.0
    long_term_debt: float               = 0.0
    deferred_tax: float                 = 0.0
    other_lt_liabilities: float         = 0.0
    total_liabilities: float            = 0.0
    common_stock: float                 = 0.0
    retained_earnings: float            = 0.0
    total_equity: float                 = 0.0

    # ── Cash Flow Statement
    stock_based_comp: float         = 0.0
    deferred_tax_change: float      = 0.0
    working_capital_change: float   = 0.0
    operating_cash_flow: float      = 0.0
    capex: float                    = 0.0
    acquisitions: float             = 0.0
    investing_cash_flow: float      = 0.0
    dividends_paid: float           = 0.0
    debt_issuance: float            = 0.0
    revolver_change: float          = 0.0   # YoY draw (+) / repayment (−) of the revolver
    financing_cash_flow: float      = 0.0
    net_cash_change: float          = 0.0
    free_cash_flow: float           = 0.0

    # ── Key Metrics
    operating_margin: float         = 0.0
    net_profit_margin: float        = 0.0
    eps: float                      = 0.0
    working_capital: float          = 0.0
    roe: float                      = 0.0
    roa: float                      = 0.0


# ============================================================
# BASE DATA EXTRACTION
# ============================================================

def extract_base_data(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None = None,
    latest_year: str | None = None,
    dcf_assumptions: dict | None = None,
) -> BaseFinancialData:
    """
    Pull the most-recent-year values from stored JSONB statements
    into a flat BaseFinancialData object.
    """
    is_l = statement_to_lookup(income_statement)
    bs_l = statement_to_lookup(balance_sheet)
    cf_l = statement_to_lookup(cash_flow) if cash_flow else {}

    # Determine latest year
    all_years = sorted({y for lu in (is_l, bs_l, cf_l) for v in lu.values() for y in v})
    year = latest_year or (all_years[-1] if all_years else str(__import__('datetime').date.today().year - 1))

    def isg(k): return _get_compat(is_l, k, year)
    def bsg(k): return _get_compat(bs_l, k, year)
    def cfg(k): return _get_compat(cf_l, k, year)

    revenue = isg("totalRevenue")
    operating_income = isg("operatingIncome")
    depreciation = abs(isg("depreciationCostOfSales") + isg("depreciationOpex"))
    ebitda = operating_income + depreciation
    operating_margin = (operating_income / revenue * 100) if revenue else 20.0

    # Derive historical cost structure ratios from actual data
    cost_of_revenue = isg("costOfRevenue")

    capex = abs(cfg("capitalExpenditures"))
    op_cf = cfg("operatingCashFlow")
    fcf   = op_cf - capex

    return BaseFinancialData(
        revenue=revenue,
        cost_of_revenue=cost_of_revenue,
        gross_profit=isg("grossProfit") or (revenue - cost_of_revenue),
        operating_income=operating_income,
        net_income=isg("netIncome"),
        depreciation=depreciation,
        interest_expense=abs(isg("financeCosts")),
        tax_expense=abs(isg("currentIncomeTax") + isg("deferredIncomeTax") + isg("zakatExpenses")),
        ebitda=ebitda,

        total_assets=bsg("totalAssets"),
        total_liabilities=bsg("totalLiabilities"),
        total_equity=bsg("totalEquity"),
        current_assets=bsg("totalCurrentAssets"),
        current_liabilities=bsg("totalCurrentLiabilities"),
        long_term_debt=bsg("ltDebtData"),
        retained_earnings=bsg("retainedEarnings"),
        ppe=bsg("grossPPE"),
        accumulated_depreciation=bsg("accumulatedDepreciation"),
        inventory=bsg("rawMaterials") + bsg("workInProcess") + bsg("finishedGoods") + bsg("otherInventory"),
        accounts_receivable=bsg("accountsReceivable") + bsg("notesReceivable"),
        accounts_payable=bsg("accountsPayable"),
        cash=bsg("cashAndEquivalents"),
        shares_outstanding=isg("basicSharesOutstanding") or isg("dilutedAverageShares") or (dcf_assumptions or {}).get("shares_outstanding") or 0.0,

        operating_cash_flow=op_cf,
        capital_expenditure=capex,
        free_cash_flow=fcf,

        last_year=_parse_year(year),
        operating_margin=operating_margin,
    )


# ============================================================
# HISTORICAL ASSUMPTIONS DERIVATION
# ============================================================

def calculate_historical_assumptions(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None = None,
) -> ForecastInputs:
    """
    Derive sensible ForecastInputs from historical financial data.
    Falls back to reasonable defaults when data is insufficient.
    """
    is_l = statement_to_lookup(income_statement)
    bs_l = statement_to_lookup(balance_sheet)
    cf_l = statement_to_lookup(cash_flow) if cash_flow else {}

    years = sorted({y for lu in (is_l, bs_l) for v in lu.values() for y in v})

    _defaults = ForecastInputs()

    if len(years) < 2:
        return _defaults

    # ── Revenue growth (average YoY) ────────────────────────
    revenue_growths = []
    for i in range(1, len(years)):
        y_curr_str, y_prev_str = years[i], years[i - 1]
        try:
            if int(y_curr_str) - int(y_prev_str) != 1:
                continue
        except ValueError:
            pass # if not integers, proceed anyway (e.g. FY21, FY22)
            
        rev_curr = _get_compat(is_l, "totalRevenue", y_curr_str)
        rev_prev = _get_compat(is_l, "totalRevenue", y_prev_str)
        if rev_prev > 0:
            revenue_growths.append(((rev_curr - rev_prev) / rev_prev) * 100)
    avg_rev_growth = (sum(revenue_growths) / len(revenue_growths)) if revenue_growths else 10.0

    # ── CapEx as % of revenue ────────────────────────────────
    capex_pcts = []
    for y in years:
        rev = _get_compat(is_l, "totalRevenue", y)
        capex = abs(_get_compat(cf_l, "capitalExpenditure", y))
        if rev > 0:
            capex_pcts.append((capex / rev) * 100)
    avg_capex_pct = (sum(capex_pcts) / len(capex_pcts)) if capex_pcts else 3.0

    # ── Effective tax rate ───────────────────────────────────
    tax_rates = []
    for y in years:
        ebt = _get_compat(is_l, "incomeBeforeTax", y)
        tax = _get_compat(is_l, "incomeTaxExpense", y)
        if ebt > 0:
            tax_rates.append((tax / ebt) * 100)
    avg_tax_rate = (sum(tax_rates) / len(tax_rates)) if tax_rates else 25.0

    # ── Depreciation as % of revenue ────────────────────────
    dep_pcts = []
    for y in years:
        rev = _get_compat(is_l, "totalRevenue", y)
        dep = abs(_get_compat(is_l, "depreciation", y))
        if rev > 0:
            dep_pcts.append((dep / rev) * 100)
    avg_dep_pct = (sum(dep_pcts) / len(dep_pcts)) if dep_pcts else 8.0

    # ── DSO (Days Sales Outstanding) ────────────────────────
    dso_vals = []
    for y in years:
        rev = _get_compat(is_l, "totalRevenue", y)
        ar  = _get_compat(bs_l, "accountsReceivable", y)
        if rev > 0 and ar > 0:
            dso_vals.append((ar / rev) * 365)
    avg_dso = (sum(dso_vals) / len(dso_vals)) if dso_vals else 45.0

    # ── DIO (Days Inventory Outstanding) ────────────────────
    dio_vals = []
    for y in years:
        cogs = abs(_get_compat(is_l, "costOfRevenue", y))
        inv  = _get_compat(bs_l, "totalInventory", y)
        if cogs > 0 and inv > 0:
            dio_vals.append((inv / cogs) * 365)
    avg_dio = (sum(dio_vals) / len(dio_vals)) if dio_vals else 60.0

    # ── DPO (Days Payable Outstanding) ──────────────────────
    dpo_vals = []
    for y in years:
        cogs = abs(_get_compat(is_l, "costOfRevenue", y))
        ap   = _get_compat(bs_l, "tradePayables", y)
        if cogs > 0 and ap > 0:
            dpo_vals.append((ap / cogs) * 365)
    avg_dpo = (sum(dpo_vals) / len(dpo_vals)) if dpo_vals else 30.0

    return ForecastInputs(
        revenue_growth_rate=round(avg_rev_growth, 1),
        tax_rate=round(avg_tax_rate, 1),
        capex_as_pct_of_revenue=round(avg_capex_pct, 1),
        dividend_payout_ratio=30.0,
        interest_rate_on_debt=4.0,
        # Advanced ratios — derived from historicals
        dso=round(avg_dso, 1),
        dio=round(avg_dio, 1),
        dpo=round(avg_dpo, 1),
        depreciation_rate=round(avg_dep_pct, 1),
    )


# ============================================================
# FORECASTING ENGINE
# ============================================================

class ForecastingEngine:
    """
    Generates complete 5-year IS + BS + CFS projections.

    Two balance modes:
      "balanced" — cash (+ revolver) is the plug: Assets = Liabilities + Equity
                   is FORCED every year regardless of input data quality.
      "faithful" — cash is driven by the cash flow statement
                   (cash = prior cash + OCF + ICF + FCF). Nothing is plugged,
                   so any imbalance in the base-year balance sheet carries
                   through UNCHANGED into every forecast year. Balanced input
                   stays balanced; imbalanced input stays imbalanced.
    """

    def __init__(
        self,
        base_data: BaseFinancialData,
        inputs: ForecastInputs,
        forecast_years: int = 5,
        balance_mode: Literal["balanced", "faithful"] = "balanced",
    ):
        self.base = base_data
        self.inputs = inputs
        self.forecast_years = forecast_years
        self.balance_mode = balance_mode

    def generate_forecast(
        self,
        scenario: ForecastScenario | None = None,
    ) -> list[YearlyForecast]:
        if scenario is None:
            scenario = ForecastScenario()

        b = self.base
        inp = self.inputs

        # Derive historical cost ratios from base data (better than hardcoded %)
        cogs_pct = (b.cost_of_revenue / b.revenue) if b.revenue else 0.60
        sga_pct  = max(0.05, ((b.operating_income / b.revenue) - (1 - cogs_pct - inp.depreciation_rate / 100) + 0.08)) if b.revenue else 0.25
        rd_pct   = 0.08  # Default — not separately tracked in most IS uploads

        faithful = self.balance_mode == "faithful"

        # ── Faithful mode: base-year residuals held CONSTANT ────────
        # These are the parts of the base BS not explicitly modeled
        # (other current assets, non-PPE non-current assets, other
        # liabilities). Holding them fixed — instead of fabricating them
        # as % of revenue — means every forecast flow touches assets and
        # liabilities+equity symmetrically, so the base-year imbalance
        # (if any) carries through each year EXACTLY, never amplified.
        base_other_ca  = b.current_assets - b.cash - b.accounts_receivable - b.inventory
        base_other_nca = b.total_assets - b.current_assets - (b.ppe - b.accumulated_depreciation)
        base_other_cl  = b.current_liabilities - b.accounts_payable
        base_other_ltl = b.total_liabilities - b.current_liabilities - b.long_term_debt

        # Cumulative / stateful values
        current_revenue           = b.revenue
        cumulative_retained       = b.retained_earnings
        cumulative_ppe            = b.ppe
        cumulative_depreciation   = b.accumulated_depreciation
        current_cash              = b.cash
        current_debt              = b.long_term_debt
        current_revolver          = 0.0   # short-term borrowing plug (balanced mode only)
        # Prior-year working-capital balances (for actual Δ-based WC change)
        prev_ar, prev_inv, prev_ap = b.accounts_receivable, b.inventory, b.accounts_payable

        forecasts: list[YearlyForecast] = []

        for idx in range(self.forecast_years):
            year = b.last_year + idx + 1

            # Per-year growth when revenue_growth_rates is provided,
            # otherwise the single flat rate; scenario multiplier on top.
            adj_growth = inp.growth_for_year(idx) * scenario.revenue_growth_multiplier

            # ── Revenue ──────────────────────────────────────
            current_revenue *= (1 + adj_growth / 100)

            # ── INCOME STATEMENT ─────────────────────────────
            cost_of_revenue   = current_revenue * cogs_pct
            gross_profit      = current_revenue - cost_of_revenue
            depreciation      = current_revenue * (inp.depreciation_rate / 100)
            sga_expenses      = current_revenue * sga_pct
            rd_expenses       = current_revenue * rd_pct
            total_op_expenses = sga_expenses + rd_expenses + depreciation

            # Calculate Operating Income BOTTOM-UP to fix the top-down/bottom-up mismatch
            operating_income  = gross_profit - total_op_expenses
            ebitda            = operating_income + depreciation

            interest_income   = current_cash * 0.02
            # Interest is charged on LT debt plus the PRIOR year's revolver
            # balance (using prior balance avoids a circular reference with
            # this year's cash plug below).
            interest_expense  = (current_debt + current_revolver) * (inp.interest_rate_on_debt / 100)
            income_before_tax = operating_income + interest_income - interest_expense
            tax_expense       = income_before_tax * (inp.tax_rate / 100)
            net_income        = income_before_tax - tax_expense

            # ── BALANCE SHEET — modeled working-capital items ─
            # AR/Inv/AP are ratio-driven (DSO/DIO/DPO) in BOTH modes.
            accounts_receivable = current_revenue * (inp.dso / 365)
            inventory           = cost_of_revenue * (inp.dio / 365)
            accounts_payable    = cost_of_revenue * (inp.dpo / 365)

            # CapEx & PPE roll-forward (both modes)
            # BUGFIX: gross PPE grows by capex ONLY. The old code did
            # `cumulative_ppe += capex - depreciation` while ALSO accumulating
            # depreciation separately, shrinking net PPE by depreciation twice
            # per year (the balanced-mode plug silently absorbed the error).
            capex = current_revenue * (inp.capex_as_pct_of_revenue / 100)
            cumulative_ppe          += capex
            cumulative_depreciation += depreciation
            net_ppe = cumulative_ppe - cumulative_depreciation

            # Working-capital change from ACTUAL YoY deltas (replaces the old
            # "% of revenue" knob). Stored using the CFS adjustment convention:
            # negative when working capital grows (a use of cash).
            wc_adjustment = -((accounts_receivable - prev_ar)
                              + (inventory - prev_inv)
                              - (accounts_payable - prev_ap))

            # ── Equity (both modes) ──────────────────────────
            # Dividends floored at 0 — no negative payout when NI < 0.
            common_stock   = b.total_equity - b.retained_earnings or 100_000_000
            dividends_paid = max(0.0, net_income * (inp.dividend_payout_ratio / 100))
            cumulative_retained += net_income - dividends_paid
            total_equity   = common_stock + cumulative_retained

            if faithful:
                # ═════════ FAITHFUL MODE — CFS-driven cash, no plug ═════════
                # Unmodeled BS lines stay at base-year values; no fabricated
                # SBC / acquisitions / deferred tax / debt issuance. Every flow
                # hits assets and L+E symmetrically, so the base imbalance
                # carries through each year exactly.
                other_current_assets      = base_other_ca
                goodwill                  = base_other_nca   # all other non-current assets
                other_intangibles         = 0.0
                other_current_liabilities = base_other_cl
                deferred_tax              = 0.0
                other_lt_liabilities      = base_other_ltl
                acquisitions              = 0.0
                stock_based_comp          = 0.0
                deferred_tax_change       = 0.0
                debt_issuance             = 0.0
                revolver_change           = 0.0   # no revolver in faithful mode

                operating_cash_flow = net_income + depreciation + wc_adjustment
                investing_cash_flow = -capex
                financing_cash_flow = -dividends_paid

                # CASH IS DRIVEN BY THE CFS — not solved for.
                net_cash_change = operating_cash_flow + investing_cash_flow + financing_cash_flow
                current_cash    = current_cash + net_cash_change

                non_cash_current_assets   = accounts_receivable + inventory + other_current_assets
                total_current_assets      = current_cash + non_cash_current_assets
                total_assets              = total_current_assets + net_ppe + goodwill
                total_current_liabilities = accounts_payable + other_current_liabilities
                total_liabilities         = total_current_liabilities + current_debt + other_lt_liabilities

            else:
                # ═════════ BALANCED MODE — cash/revolver plug ═════════
                other_current_assets    = current_revenue * 0.05
                non_cash_current_assets = accounts_receivable + inventory + other_current_assets
                acquisitions            = current_revenue * 0.01
                goodwill                = b.total_assets * 0.10
                other_intangibles       = b.total_assets * 0.05

                # Sum of all assets EXCEPT cash
                non_cash_assets = non_cash_current_assets + net_ppe + goodwill + other_intangibles

                other_current_liabilities = current_revenue * 0.03
                # Use non_cash_assets as proxy to prevent circular dependency on deferred tax
                deferred_tax         = non_cash_assets * 0.02
                other_lt_liabilities = non_cash_assets * 0.03

                # ── CASH / REVOLVER PLUG ─────────────────────
                # Pre-revolver L+E − non-cash assets = cash surplus (or shortfall).
                # Positive → cash balance (revolver repaid to 0).
                # Negative → cash floors at 0, shortfall drawn on a short-term
                # revolver, so Assets = Liabilities + Equity ALWAYS holds.
                prev_revolver = current_revolver
                pre_revolver_liabilities = (
                    accounts_payable + other_current_liabilities
                    + current_debt + deferred_tax + other_lt_liabilities
                )
                cash_surplus = (pre_revolver_liabilities + total_equity) - non_cash_assets

                if cash_surplus >= 0:
                    current_cash     = cash_surplus
                    current_revolver = 0.0
                else:
                    current_cash     = 0.0
                    current_revolver = -cash_surplus  # draw exactly the shortfall

                revolver_change = current_revolver - prev_revolver

                # Final totals (revolver sits in current liabilities)
                total_current_liabilities = accounts_payable + other_current_liabilities + current_revolver
                total_liabilities         = pre_revolver_liabilities + current_revolver
                total_current_assets      = current_cash + non_cash_current_assets
                total_assets              = total_current_assets + net_ppe + goodwill + other_intangibles

                # ── CASH FLOW STATEMENT (display; cash comes from the plug) ──
                stock_based_comp    = current_revenue * 0.02
                deferred_tax_change = non_cash_assets * 0.001
                operating_cash_flow = (
                    net_income + depreciation + stock_based_comp
                    + deferred_tax_change + wc_adjustment
                )
                investing_cash_flow = -(capex + acquisitions)
                debt_issuance       = (current_revenue * 0.05) if idx == 0 else 0.0
                # Revolver draws (+) / repayments (−) are financing flows
                financing_cash_flow = -dividends_paid + debt_issuance + revolver_change

                # Force net_cash_change to equal the actual change in the cash plug.
                previous_cash   = b.cash if idx == 0 else forecasts[-1].cash
                net_cash_change = current_cash - previous_cash

            # Roll working-capital state for next year's deltas
            prev_ar, prev_inv, prev_ap = accounts_receivable, inventory, accounts_payable

            free_cash_flow = operating_cash_flow - capex

            # ── KEY METRICS ──────────────────────────────────
            # Margin is an OUTPUT metric based on the actual IS math
            operating_margin_out = (operating_income / current_revenue * 100) if current_revenue else 0.0
            working_capital = total_current_assets - total_current_liabilities
            eps = (net_income / b.shares_outstanding) if b.shares_outstanding else 0.0
            roe = (net_income / total_equity) if total_equity else 0.0
            roa = (net_income / total_assets)  if total_assets else 0.0

            forecasts.append(YearlyForecast(
                year=year,
                revenue=round(current_revenue, 2),
                cost_of_revenue=round(cost_of_revenue, 2),
                gross_profit=round(gross_profit, 2),
                sga_expenses=round(sga_expenses, 2),
                rd_expenses=round(rd_expenses, 2),
                depreciation=round(depreciation, 2),
                total_op_expenses=round(total_op_expenses, 2),
                operating_income=round(operating_income, 2),
                interest_income=round(interest_income, 2),
                interest_expense=round(interest_expense, 2),
                income_before_tax=round(income_before_tax, 2),
                tax_expense=round(tax_expense, 2),
                net_income=round(net_income, 2),
                ebitda=round(ebitda, 2),
                cash=round(current_cash, 2),
                accounts_receivable=round(accounts_receivable, 2),
                inventory=round(inventory, 2),
                other_current_assets=round(other_current_assets, 2),
                total_current_assets=round(total_current_assets, 2),
                ppe=round(cumulative_ppe, 2),
                accumulated_depreciation=round(cumulative_depreciation, 2),
                goodwill=round(goodwill, 2),
                other_intangibles=round(other_intangibles, 2),
                total_assets=round(total_assets, 2),
                accounts_payable=round(accounts_payable, 2),
                other_current_liabilities=round(other_current_liabilities, 2),
                revolver=round(current_revolver, 2),
                total_current_liabilities=round(total_current_liabilities, 2),
                long_term_debt=round(current_debt, 2),
                deferred_tax=round(deferred_tax, 2),
                other_lt_liabilities=round(other_lt_liabilities, 2),
                total_liabilities=round(total_liabilities, 2),
                common_stock=round(common_stock, 2),
                retained_earnings=round(cumulative_retained, 2),
                total_equity=round(total_equity, 2),
                stock_based_comp=round(stock_based_comp, 2),
                deferred_tax_change=round(deferred_tax_change, 2),
                working_capital_change=round(wc_adjustment, 2),
                operating_cash_flow=round(operating_cash_flow, 2),
                capex=round(capex, 2),
                acquisitions=round(acquisitions, 2),
                investing_cash_flow=round(investing_cash_flow, 2),
                dividends_paid=round(dividends_paid, 2),
                debt_issuance=round(debt_issuance, 2),
                revolver_change=round(revolver_change, 2),
                financing_cash_flow=round(financing_cash_flow, 2),
                net_cash_change=round(net_cash_change, 2),
                free_cash_flow=round(free_cash_flow, 2),
                operating_margin=round(operating_margin_out, 4),
                net_profit_margin=round((net_income / current_revenue * 100) if current_revenue else 0, 4),
                eps=round(eps, 4),
                working_capital=round(working_capital, 2),
                roe=round(roe, 4),
                roa=round(roa, 4),
            ))

        return forecasts

    def calculate_cumulative_metrics(self, forecasts: list[YearlyForecast]) -> dict:
        if not forecasts:
            return {}
        n = len(forecasts)
        total_rev   = sum(f.revenue for f in forecasts)
        total_ni    = sum(f.net_income for f in forecasts)
        total_fcf   = sum(f.free_cash_flow for f in forecasts)
        total_capex = sum(f.capex for f in forecasts)
        total_div   = sum(f.dividends_paid for f in forecasts)

        base_rev = self.base.revenue
        last_rev = forecasts[-1].revenue
        if base_rev > 0 and last_rev > 0:
            cagr = ((last_rev / base_rev) ** (1 / n) - 1) * 100
        else:
            cagr = 0.0

        return {
            "total_revenue":             round(total_rev, 2),
            "total_net_income":          round(total_ni, 2),
            "total_free_cash_flow":      round(total_fcf, 2),
            "total_capex":               round(total_capex, 2),
            "total_dividends":           round(total_div, 2),
            "revenue_cagr":              round(cagr, 2),
            "avg_operating_margin":      round(sum(f.operating_margin for f in forecasts) / n, 2),
            "avg_net_margin":            round(sum(f.net_profit_margin for f in forecasts) / n, 2),
        }

    def validate_balance_sheet(self, forecasts: list[YearlyForecast]) -> list[dict]:
        results = []
        for f in forecasts:
            diff = abs(f.total_assets - (f.total_liabilities + f.total_equity))
            results.append({
                "year":      f.year,
                "balanced":  diff < 1.0,
                "difference": round(diff, 2),
                "total_assets":             round(f.total_assets, 2),
                "total_liabilities_equity": round(f.total_liabilities + f.total_equity, 2),
            })
        return results


# ============================================================
# CONVENIENCE WRAPPER (called by routes)
# ============================================================

def run_forecast(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None,
    inputs: dict,
    scenarios: list[str] | None = None,
    forecast_years: int = 5,
    dcf_assumptions: dict | None = None,
    balance_mode: str = "balanced",
) -> dict:
    """
    Full forecasting pipeline:
      1. Extract base data from stored statements
      2. Build ForecastInputs from provided dict
      3. Run base + optional scenario forecasts
      4. Return structured response

    balance_mode:
      "balanced" — cash/revolver plug forces A = L + E every year.
      "faithful" — CFS-driven cash; base-year imbalance carries through.
    """
    base = extract_base_data(income_statement, balance_sheet, cash_flow, dcf_assumptions=dcf_assumptions)

    # Optional per-year growth override: list of % rates, one per forecast year
    raw_growth_rates = inputs.get("revenue_growth_rates")
    growth_rates = [float(g) for g in raw_growth_rates] if raw_growth_rates else None

    fi = ForecastInputs(
        # Core assumptions
        revenue_growth_rate     = float(inputs.get("revenue_growth_rate", 10.0)),
        revenue_growth_rates    = growth_rates,
        tax_rate                = float(inputs.get("tax_rate", 25.0)),
        capex_as_pct_of_revenue = float(inputs.get("capex_as_pct_of_revenue", 3.0)),
        dividend_payout_ratio   = float(inputs.get("dividend_payout_ratio", 30.0)),
        interest_rate_on_debt   = float(inputs.get("interest_rate_on_debt", 4.0)),
        # Advanced operating ratios
        dso                     = float(inputs.get("dso", 45.0)),
        dio                     = float(inputs.get("dio", 60.0)),
        dpo                     = float(inputs.get("dpo", 30.0)),
        depreciation_rate       = float(inputs.get("depreciation_rate", 8.0)),
    )

    if balance_mode not in ("balanced", "faithful"):
        balance_mode = "balanced"
    engine = ForecastingEngine(base, fi, forecast_years, balance_mode=balance_mode)

    scenario_map = {
        "base":        ForecastScenario("base",        1.0),
        "optimistic":  ForecastScenario("optimistic",  1.3),
        "pessimistic": ForecastScenario("pessimistic", 0.7),
    }

    def _project_statement(statement: dict | None, multiplier: float, base_year_str: str, yr_forecast: YearlyForecast, overrides: dict) -> dict:
        if not statement or "rows" not in statement: return {}
        proj = {}
        for r in statement["rows"]:
            key = r.get("key")
            if not key: continue
            
            # Use explicitly calculated value if available
            if key in overrides:
                proj[key] = overrides[key]
            else:
                # Otherwise grow proportionally
                base_val = r.get("values", {}).get(base_year_str)
                if base_val is not None:
                    proj[key] = float(base_val) * multiplier
                else:
                    proj[key] = 0.0
        return proj

    active_scenarios = scenarios or ["base"]
    scenario_results = {}
    
    base_year_str = str(base.last_year)

    for s_name in active_scenarios:
        scen = scenario_map.get(s_name, scenario_map["base"])
        forecasts = engine.generate_forecast(scen)
        
        full_forecasts = []
        for f in forecasts:
            d = asdict(f)
            
            rev_mult = (f.revenue / base.revenue) if base.revenue else 1.0
            ast_mult = (f.total_assets / base.total_assets) if base.total_assets else 1.0
            
            is_overrides = {
                "revenueHeader": f.revenue,
                "totalRevenue": f.revenue,
                "costOfRevenueDisplayHeader": f.cost_of_revenue,
                "totalCostOfRevenue": f.cost_of_revenue,
                "grossProfit": f.gross_profit,
                "grossProfitHeader": f.gross_profit,
                "operatingExpensesHeader": -f.sga_expenses - f.rd_expenses - f.depreciation,
                "totalSellingExpense": -f.sga_expenses * 0.5,
                "totalGeneralAdminExpense": -f.sga_expenses,
                "researchAndDevelopment": -f.rd_expenses,
                "depreciationOpex": -f.depreciation,
                "operatingIncomeDisplayHeader": f.operating_income,
                "operatingIncome": f.operating_income,
                "nonOperatingHeader": f.income_before_tax - f.operating_income,
                "financeCosts": -f.interest_expense,
                "incomeBeforeTax": f.income_before_tax,
                "earningsBeforeTax": f.income_before_tax,
                "incomeTaxExpense": -f.tax_expense,
                "currentIncomeTax": -f.tax_expense,
                "netIncome": f.net_income,
                "netIncomeAttributableToParent": f.net_income,
                "totalComprehensiveIncome": f.net_income
            }
            d["full_income_statement"] = _project_statement(income_statement, rev_mult, base_year_str, f, is_overrides)
            
            bs_overrides = {
                "cashAndEquivalents": f.cash,
                "receivablesHeader": f.accounts_receivable,
                "netReceivables": f.accounts_receivable,
                "inventoryHeader": f.inventory,
                "totalInventory": f.inventory,
                "currentAssetsHeader": f.total_current_assets,
                "totalCurrentAssets": f.total_current_assets,
                "ppeHeader": f.ppe - f.accumulated_depreciation,
                "netPPE": f.ppe - f.accumulated_depreciation,
                "grossPPE": f.ppe,
                "intangibleAssetsHeader": f.goodwill + f.other_intangibles,
                "netIntangibleAssets": f.goodwill + f.other_intangibles,
                "grossIntangibleAssets": f.goodwill + f.other_intangibles,
                "nonCurrentAssetsHeader": (f.ppe - f.accumulated_depreciation) + f.goodwill + f.other_intangibles,
                "totalNonCurrentAssets": (f.ppe - f.accumulated_depreciation) + f.goodwill + f.other_intangibles,
                "assetsHeader": f.total_assets,
                "totalAssets": f.total_assets,
                "stBorrowingsData": f.revolver,   # revolver plug shows as ST borrowings
                "currentPortionLTDebt": 0.0,
                "currentLiabilitiesHeader": f.total_current_liabilities,
                "totalCurrentLiabilities": f.total_current_liabilities,
                "ltDebtData": f.long_term_debt,
                "nonCurrentLiabilitiesHeader": f.long_term_debt + f.deferred_tax + f.other_lt_liabilities,
                "totalNonCurrentLiabilities": f.long_term_debt + f.deferred_tax + f.other_lt_liabilities,
                "liabilitiesHeader": f.total_liabilities,
                "totalLiabilities": f.total_liabilities,
                "equityHeader": f.total_equity,
                "totalEquity": f.total_equity,
                "totalLiabilitiesAndEquity": f.total_liabilities + f.total_equity,
                "balanceCheck": f.total_assets - (f.total_liabilities + f.total_equity)
            }
            d["full_balance_sheet"] = _project_statement(balance_sheet, ast_mult, base_year_str, f, bs_overrides)
            
            cf_overrides = {
                "netIncome": f.net_income,
                "cfNetIncomeData": f.net_income,
                "depreciationAmortization": f.depreciation,
                "totalNonCashAdjustments": f.depreciation,
                "changeInWorkingCapital": f.working_capital_change,
                "totalWorkingCapitalAdjustments": f.working_capital_change,
                "operatingActivitiesHeader": f.operating_cash_flow,
                "operatingCashFlow": f.operating_cash_flow,
                "capitalExpenditures": -f.capex,
                "investingActivitiesHeader": f.investing_cash_flow,
                "investingCashFlow": f.investing_cash_flow,
                "cfStBorrowings": f.revolver_change,   # revolver draws/repayments
                "cfLtDebtIssued": f.debt_issuance if f.debt_issuance > 0 else 0,
                "cfDebtRepaid": f.debt_issuance if f.debt_issuance < 0 else 0,
                "cfDividendsPaid": -f.dividends_paid,
                "financingActivitiesHeader": f.financing_cash_flow,
                "financingCashFlow": f.financing_cash_flow,
                "netIncreaseDecreaseCash": f.net_cash_change,
                "cfEndingCashBalance": f.cash
            }
            d["full_cash_flow_statement"] = _project_statement(cash_flow, rev_mult, base_year_str, f, cf_overrides)
            
            full_forecasts.append(d)

        scenario_results[s_name] = {
            "forecasts":          full_forecasts,
            "cumulative_metrics": engine.calculate_cumulative_metrics(forecasts),
            "balance_sheet_check": engine.validate_balance_sheet(forecasts),
        }

    # Base-year reconciliation: surfaced so the UI can warn when the
    # uploaded balance sheet doesn't balance (relevant in both modes —
    # in "balanced" mode the plug silently absorbs it otherwise).
    base_imbalance = round(base.total_assets - (base.total_liabilities + base.total_equity), 2)

    return {
        "base_year":       base.last_year,
        "forecast_years":  forecast_years,
        "balance_mode":    balance_mode,
        "base_imbalance":  base_imbalance,
        "inputs":          asdict(fi),
        "scenarios":       scenario_results,
    }
