"""
Analysis Engine Service
=======================
All financial arithmetic lives here — in Python, as required by the SRS.

Ratio implementation ported from the reference `ratioCalculations.ts`,
covering all 32 ratios across 7 categories.

Modules:
  - compute_ratios()              → All 32 ratios per year  (SRS §3.4)
  - compute_horizontal_analysis() → YoY % change table      (SRS §3.4)
  - compute_dcf_base_metrics()    → Base FCF & WACC for DCF  (SRS §3.6)

NOTE: The Cash Flow Statement is derived on the FRONTEND (calculations.js
deriveCashFlow) as the user edits IS/BS, then persisted; the backend only
reads the stored statement. A dead Python duplicate of that derivation was
removed from this module — do not reintroduce a second implementation.
"""

from __future__ import annotations
import pandas as pd
from typing import Any

from app.services.shared_utils import _get_compat, _build_lookups


# ============================================================
# RATIO DEFINITIONS
# Maps ratioId → metadata for display in the frontend
# ============================================================
RATIO_DEFINITIONS: dict[str, dict] = {
    # Liquidity
    "currentRatio":           {"label": "Current Ratio",           "category": "Liquidity",    "format": "ratio"},
    "quickRatio":             {"label": "Quick Ratio",             "category": "Liquidity",    "format": "ratio"},
    "cashRatio":              {"label": "Cash Ratio",              "category": "Liquidity",    "format": "ratio"},
    # Solvency
    "debtToEquity":           {"label": "Debt to Equity",          "category": "Solvency",     "format": "ratio"},
    "debtToAssets":           {"label": "Debt to Assets",          "category": "Solvency",     "format": "ratio"},
    "debtToCapital":          {"label": "Debt to Capital",         "category": "Solvency",     "format": "ratio"},
    # Coverage
    "interestCoverage":       {"label": "Interest Coverage",       "category": "Coverage",     "format": "ratio"},
    "debtServiceCoverage":    {"label": "Debt Service Coverage",   "category": "Coverage",     "format": "ratio"},
    "cashFlowToDebt":         {"label": "Cash Flow to Debt",       "category": "Coverage",     "format": "ratio"},
    # Profitability
    "grossMargin":            {"label": "Gross Margin",            "category": "Profitability","format": "percent"},
    "operatingMargin":        {"label": "Operating Margin",        "category": "Profitability","format": "percent"},
    "netProfitMargin":        {"label": "Net Profit Margin",       "category": "Profitability","format": "percent"},
    "roa":                    {"label": "Return on Assets (ROA)",  "category": "Profitability","format": "percent"},
    "roe":                    {"label": "Return on Equity (ROE)",  "category": "Profitability","format": "percent"},
    "roic":                   {"label": "Return on Invested Capital (ROIC)", "category": "Profitability", "format": "percent"},
    # Efficiency
    "assetTurnover":          {"label": "Asset Turnover",          "category": "Efficiency",   "format": "ratio"},
    "inventoryTurnover":      {"label": "Inventory Turnover",      "category": "Efficiency",   "format": "ratio"},
    "daysSalesInventory":     {"label": "Days Sales of Inventory", "category": "Efficiency",   "format": "days"},
    "receivablesTurnover":    {"label": "Receivables Turnover",    "category": "Efficiency",   "format": "ratio"},
    "daysSalesOutstanding":   {"label": "Days Sales Outstanding",  "category": "Efficiency",   "format": "days"},
    "accountsPayableTurnover":{"label": "Accounts Payable Turnover","category":"Efficiency",   "format": "ratio"},
    "daysPayableOutstanding": {"label": "Days Payable Outstanding","category": "Efficiency",   "format": "days"},
    "cashConversionCycle":    {"label": "Cash Conversion Cycle",   "category": "Efficiency",   "format": "days"},
    "workingCapitalRatio":    {"label": "Working Capital Ratio",   "category": "Efficiency",   "format": "percent"},
    # Market Prospect
    "peRatio":                {"label": "P/E Ratio",               "category": "Market",       "format": "ratio"},
    "priceToSales":           {"label": "Price to Sales",          "category": "Market",       "format": "ratio"},
    "priceToBook":            {"label": "Price to Book",           "category": "Market",       "format": "ratio"},
    "evToEbitda":             {"label": "EV / EBITDA",             "category": "Market",       "format": "ratio"},
    "dividendYield":          {"label": "Dividend Yield",          "category": "Market",       "format": "percent"},
    # Per Share
    "basicEPS":               {"label": "Basic EPS",               "category": "Per Share",    "format": "currency"},
    "revenuePerShare":        {"label": "Revenue per Share",       "category": "Per Share",    "format": "currency"},
    "bookValuePerShare":      {"label": "Book Value per Share",    "category": "Per Share",    "format": "currency"},
    "freeCashFlowPerShare":   {"label": "Free Cash Flow per Share","category": "Per Share",    "format": "currency"},
    "dividendPayoutRatio":    {"label": "Dividend Payout Ratio",   "category": "Per Share",    "format": "percent"},
    "dividendsPerShare":      {"label": "Dividends per Share",     "category": "Per Share",    "format": "currency"},
}

ALL_RATIO_IDS: list[str] = list(RATIO_DEFINITIONS.keys())


# ============================================================
# HELPERS
# ============================================================

def _safe_div(numerator: Any, denominator: Any) -> float | None:
    """Safe division — returns None on zero / None / NaN inputs."""
    try:
        n, d = float(numerator), float(denominator)
        if d == 0 or (n != n) or (d != d):  # NaN check
            return None
        return round(n / d, 6)
    except (TypeError, ValueError):
        return None



def _get(lookup: dict[str, dict[str, float]], key: str, year: str) -> float:
    """Get a value from the flat lookup dict; returns 0.0 if missing.

    Thin alias over shared_utils._get_compat — the compat/fallback key
    mapping lives ONLY in shared_utils.py (shared with forecasting_engine).
    """
    return _get_compat(lookup, key, year)


def _get_avg(
    lookup: dict[str, dict[str, float]],
    key: str,
    year: str,
    prev_year: str | None,
) -> float:
    """Return average of current and previous year values for turnover ratios."""
    current = _get(lookup, key, year)
    if not prev_year:
        return current
    previous = _get(lookup, key, prev_year)
    return (current + previous) / 2 if (current or previous) else 0.0


# ============================================================
# SINGLE RATIO CALCULATION  (all 32 ratios)
# ============================================================

def calculate_ratio(
    ratio_id: str,
    year: str,
    is_lookup: dict[str, dict[str, float]],
    bs_lookup: dict[str, dict[str, float]],
    cf_lookup: dict[str, dict[str, float]],
    prev_year: str | None = None,
) -> float | None:
    """
    Calculate a single ratio for a given year.
    Direct Python port of the reference ratioCalculations.ts.
    """
    # Shorthand helpers
    isg = lambda k: _get(is_lookup, k, year)
    bsg = lambda k: _get(bs_lookup, k, year)
    cfg = lambda k: _get(cf_lookup, k, year)
    bsavg = lambda k: _get_avg(bs_lookup, k, year, prev_year)

    # ── Common line items (mirrors reference TS) ─────────────────
    revenue = isg("revenueHeader") or isg("totalRevenue")
    cost_of_goods_sold = abs(isg("costOfRevenueDisplayHeader") or isg("totalCostOfRevenue") or isg("costOfRevenue"))
    gross_profit = isg("grossProfitHeader") or isg("grossProfit") or (revenue - cost_of_goods_sold)
    operating_income = isg("operatingIncomeDisplayHeader") or isg("operatingIncome")
    net_income = isg("netIncomeAttributableToParent") or isg("netIncome")
    interest_expense = abs(isg("financeCosts"))
    income_tax_expense = abs(isg("currentIncomeTax") + isg("deferredIncomeTax") + isg("zakatExpenses"))
    income_before_tax = isg("incomeBeforeTax")
    depreciation = abs(isg("depreciationCostOfSales") + isg("depreciationOpex"))
    ebitda = isg("ebitda") or (operating_income + depreciation)

    # Balance sheet items
    cash = bsg("cashAndEquivalents")
    current_assets = bsg("currentAssetsHeader") or bsg("totalCurrentAssets")
    current_liabilities = bsg("currentLiabilitiesHeader") or bsg("totalCurrentLiabilities")
    inventory = bsg("inventoryHeader") or bsg("totalInventory") or (bsg("rawMaterials") + bsg("workInProcess") + bsg("finishedGoods") + bsg("otherInventory"))
    accounts_receivable = bsg("receivablesHeader") or bsg("netReceivables") or (bsg("tradeAccountsReceivable") + bsg("notesReceivable"))
    accounts_payable = bsg("tradePayablesHeader") or bsg("accountsPayable")
    total_assets = bsg("assetsHeader") or bsg("totalAssets")
    total_liabilities = bsg("liabilitiesHeader") or bsg("totalLiabilities")
    # NOTE: "currentDebt" is a COMPAT ALIAS for "currentPortionLTDebt" (see
    # KEY_COMPAT_MAP), so bsg("currentDebt") already resolves the canonical row
    # and falls back to a legacy one. Adding both counted it twice and inflated
    # every debt ratio. Keep this identical to the DCF-side definition below.
    current_debt = bsg("stBorrowingsData") + bsg("currentDebt")
    long_term_debt = bsg("ltDebtData")
    other_debt = 0.0
    total_debt = current_debt + long_term_debt + other_debt
    total_equity = bsg("equityHeader") or bsg("totalEquity")
    total_capital = total_debt + total_equity

    # Cash flow items
    operating_cf = cfg("operatingActivitiesHeader") or cfg("operatingCashFlow")
    capex = abs(cfg("capitalExpenditures"))
    free_cf = operating_cf - capex

    # Per share / market data
    shares = isg("basicSharesOutstanding") or isg("basicAverageShares") or isg("dilutedAverageShares")
    diluted_shares = isg("dilutedAverageShares") or shares
    price = isg("pricePerShare")
    market_cap = isg("marketCap") or (price * shares if price and shares else 0.0)
    total_dividends_paid = abs(cfg("commonStockDividendPaid") or cfg("dividendsPaid"))
    # No template row carries a *declared* DPS, so fall back to dividends
    # actually paid (from the CFS) divided by shares. Without this fallback the
    # key resolves to 0 for every project and dividend yield reads a silent zero.
    dividends_per_share = isg("commonStockDividendPerShare") or (
        _safe_div(total_dividends_paid, shares) if shares else 0.0
    ) or 0.0

    # Derived aggregates
    enterprise_value = market_cap + total_debt - cash
    invested_capital = total_debt + total_equity - cash
    working_capital = current_assets - current_liabilities
    basic_eps = isg("basicEPS") or (_safe_div(net_income, shares) if shares else None) or 0.0

    # ── Tax rate for ROIC ────────────────────────────────────────
    tax_rate = _safe_div(income_tax_expense, income_before_tax) if income_before_tax else 0.25
    if tax_rate is None or tax_rate < 0 or tax_rate > 1:
        tax_rate = 0.25

    # ── Turnover averages ────────────────────────────────────────
    avg_total_assets = bsavg("totalAssets")
    avg_inventory = bsavg("inventory")
    avg_receivables = bsavg("accountsReceivable") or bsavg("netReceivables")
    avg_payables = bsavg("accountsPayable")

    # ============================================================
    match ratio_id:

        # ── LIQUIDITY ────────────────────────────────────────────
        case "currentRatio":
            return _safe_div(current_assets, current_liabilities)

        case "quickRatio":
            return _safe_div(current_assets - inventory, current_liabilities)

        case "cashRatio":
            return _safe_div(cash, current_liabilities)

        # ── SOLVENCY ─────────────────────────────────────────────
        case "debtToEquity":
            return _safe_div(total_liabilities, total_equity)

        case "debtToAssets":
            return _safe_div(total_debt, total_assets)

        case "debtToCapital":
            return _safe_div(total_debt, total_capital)

        # ── COVERAGE ─────────────────────────────────────────────
        case "interestCoverage":
            return _safe_div(operating_income, interest_expense)

        case "debtServiceCoverage":
            total_debt_service = total_debt + interest_expense
            return _safe_div(operating_cf, total_debt_service)

        case "cashFlowToDebt":
            return _safe_div(operating_cf, total_debt)

        # ── PROFITABILITY ────────────────────────────────────────
        case "grossMargin":
            return _safe_div(gross_profit, revenue)

        case "operatingMargin":
            return _safe_div(operating_income, revenue)

        case "netProfitMargin":
            return _safe_div(net_income, revenue)

        case "roa":
            return _safe_div(net_income, total_assets)

        case "roe":
            return _safe_div(net_income, total_equity)

        case "roic":
            nopat = operating_income * (1 - tax_rate)
            return _safe_div(nopat, invested_capital)

        # ── EFFICIENCY ───────────────────────────────────────────
        case "assetTurnover":
            return _safe_div(revenue, avg_total_assets)

        case "inventoryTurnover":
            return _safe_div(cost_of_goods_sold, avg_inventory)

        case "daysSalesInventory":
            inv_turnover = _safe_div(cost_of_goods_sold, avg_inventory)
            return _safe_div(365, inv_turnover) if inv_turnover else None

        case "receivablesTurnover":
            return _safe_div(revenue, avg_receivables)

        case "daysSalesOutstanding":
            rec_turnover = _safe_div(revenue, avg_receivables)
            return _safe_div(365, rec_turnover) if rec_turnover else None

        case "accountsPayableTurnover":
            return _safe_div(cost_of_goods_sold, avg_payables)

        case "daysPayableOutstanding":
            pay_turnover = _safe_div(cost_of_goods_sold, avg_payables)
            return _safe_div(365, pay_turnover) if pay_turnover else None

        case "cashConversionCycle":
            inv_turnover = _safe_div(cost_of_goods_sold, avg_inventory)
            dsi = _safe_div(365, inv_turnover) if inv_turnover else 0
            rec_turnover = _safe_div(revenue, avg_receivables)
            dso = _safe_div(365, rec_turnover) if rec_turnover else 0
            pay_turnover = _safe_div(cost_of_goods_sold, avg_payables)
            dpo = _safe_div(365, pay_turnover) if pay_turnover else 0
            return round(dsi + dso - dpo, 4)

        case "workingCapitalRatio":
            return _safe_div(working_capital, revenue)

        # ── MARKET PROSPECT ──────────────────────────────────────
        case "peRatio":
            return _safe_div(price, basic_eps) if price else None

        case "priceToSales":
            return _safe_div(market_cap, revenue) if market_cap else None

        case "priceToBook":
            return _safe_div(market_cap, total_equity) if market_cap else None

        case "evToEbitda":
            # Nothing in the template supplies a share price or market cap, so
            # without one `enterprise_value` collapses to net debt. Reporting
            # that as "EV/EBITDA" looks plausible and is wrong — report nothing.
            return _safe_div(enterprise_value, ebitda) if (market_cap and ebitda) else None

        case "dividendYield":
            return _safe_div(dividends_per_share, price) if price else None

        # ── PER SHARE ────────────────────────────────────────────
        case "basicEPS":
            # `basic_eps` already prefers the entered (audited) row and only
            # falls back to net income / shares. Recomputing here discarded the
            # user's own figure even when they had supplied it.
            return basic_eps or None

        case "revenuePerShare":
            return _safe_div(revenue, shares) if shares else None

        case "bookValuePerShare":
            return _safe_div(total_equity, shares) if shares else None

        case "freeCashFlowPerShare":
            return _safe_div(free_cf, shares) if shares else None

        case "dividendPayoutRatio":
            # Straight from the aggregates rather than DPS/EPS: it avoids
            # compounding two per-share roundings and still works when the
            # share count is missing.
            return _safe_div(total_dividends_paid, net_income) if net_income else None

        case "dividendsPerShare":
            return _safe_div(total_dividends_paid, shares) if shares else None

        case _:
            return None


# ============================================================
# BATCH CALCULATION — all 32 ratios for all years
# ============================================================

def compute_ratios(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None = None,
) -> dict:
    """
    Compute all 32 financial ratios for each available fiscal year.

    Returns:
        {
          "years": ["2021", "2022", "2023"],
          "definitions": { ratioId: {label, category, format} },
          "ratios": {
            "Liquidity": {
              "currentRatio": {"2021": 1.5, "2022": 1.6, "label": "Current Ratio", "format": "ratio"},
              ...
            },
            ...
          }
        }
    """
    is_l, bs_l, cf_l = _build_lookups(income_statement, balance_sheet, cash_flow)

    # Collect all years across all statements
    all_years: set[str] = set()
    for lookup in (is_l, bs_l, cf_l):
        for key_data in lookup.values():
            all_years.update(key_data.keys())
    years = sorted(all_years)

    if not years:
        return {"years": [], "definitions": RATIO_DEFINITIONS, "ratios": {}}

    # Compute each ratio for each year
    results_flat: dict[str, dict[str, float | None]] = {}
    for ratio_id in ALL_RATIO_IDS:
        results_flat[ratio_id] = {}
        for i, year in enumerate(years):
            prev = years[i - 1] if i > 0 else None
            results_flat[ratio_id][year] = calculate_ratio(
                ratio_id, year, is_l, bs_l, cf_l, prev_year=prev
            )

    # Group by category
    grouped: dict[str, dict] = {}
    for ratio_id, year_values in results_flat.items():
        meta = RATIO_DEFINITIONS[ratio_id]
        category = meta["category"]
        if category not in grouped:
            grouped[category] = {}
        grouped[category][ratio_id] = {
            **year_values,
            "label": meta["label"],
            "format": meta["format"],
        }

    return {"years": years, "definitions": RATIO_DEFINITIONS, "ratios": grouped}


# ============================================================
# HORIZONTAL ANALYSIS — YoY % change for all line items
# ============================================================

def _to_dataframe(statement: dict | None) -> pd.DataFrame:
    """Convert stored JSONB FinancialStatement to a pandas DataFrame (label->year->value)."""
    if not statement or "rows" not in statement:
        return pd.DataFrame()
        
    rows_data = {}
    for row in statement["rows"]:
        label = row.get("label", "Unknown")
        # Ensure labels are unique so we don't silently overwrite identical lines (like multiple UNMAPPEDs)
        while label in rows_data:
            label += " " 
        rows_data[label] = row.get("values", {})
        
    df = pd.DataFrame.from_dict(rows_data, orient="index")
    if not df.empty and df.columns.size > 0:
        df.columns = pd.Index(sorted(df.columns))
    return df.apply(pd.to_numeric, errors="coerce")


def compute_horizontal_analysis(
    income_statement: dict | None,
    balance_sheet: dict | None,
) -> dict:
    """
    YoY % change for every line item.

    Returns:
        {
          "income_statement": {
            "Revenue": {"2022_vs_2021": 0.125, "2023_vs_2022": 0.083},
            ...
          },
          "balance_sheet": { ... }
        }
    """
    result: dict[str, dict] = {}

    for key, statement in [("income_statement", income_statement), ("balance_sheet", balance_sheet)]:
        df = _to_dataframe(statement)
        if df.empty or df.columns.size < 2:
            result[key] = {}
            continue

        years = list(df.columns)
        yoy: dict[str, dict[str, float | None]] = {}
        for label in df.index:
            yoy[label] = {}
            for i in range(1, len(years)):
                prev_val = df.loc[label, years[i - 1]]
                curr_val = df.loc[label, years[i]]
                col = f"{years[i-1]} vs {years[i]}"
                if pd.isna(prev_val) or prev_val == 0:
                    yoy[label][col] = None
                elif pd.isna(curr_val):
                    yoy[label][col] = None
                else:
                    yoy[label][col] = _safe_div(curr_val - prev_val, abs(prev_val))
        result[key] = yoy

    return result


# ============================================================
# DCF BASE METRICS — for the Valuation page
# Computes base FCF and historical WACC from available data
# ============================================================

def compute_dcf_base_metrics(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None = None,
) -> dict:
    """
    Derive the base financial metrics shown on the Valuation page:
        - Base FCF (most recent year)
        - EBITDA
        - Net Debt
        - Historical WACC (cost of equity from ROE, cost of debt from interest/debt)

    Returns a dict ready for the frontend Valuation panel.
    """
    is_l, bs_l, cf_l = _build_lookups(income_statement, balance_sheet, cash_flow)

    bs_years = sorted({y for v in bs_l.values() for y in v.keys()})
    is_years = sorted({y for v in is_l.values() for y in v.keys()})
    if not bs_years or not is_years:
        return {}

    common_years = sorted(set(bs_years) & set(is_years))
    if not common_years:
        return {}
        
    latest_year = common_years[-1]
    prev_year   = bs_years[bs_years.index(latest_year) - 1] if bs_years.index(latest_year) > 0 else None

    isg = lambda k: _get(is_l, k, latest_year)
    bsg = lambda k: _get(bs_l, k, latest_year)
    cfg = lambda k: _get(cf_l, k, latest_year)

    revenue = isg("totalRevenue")
    operating_income = isg("operatingIncome")
    net_income = isg("netIncome")
    depreciation = abs(isg("depreciationCostOfSales") + isg("depreciationOpex"))
    ebitda = operating_income + depreciation
    income_before_tax = isg("incomeBeforeTax")
    income_tax_expense = abs(isg("currentIncomeTax") + isg("deferredIncomeTax") + isg("zakatExpenses"))
    # BUGFIX: was `financeCosts + financeCosts`, double-counting interest
    # expense and inflating the DCF cost-of-debt estimate.
    interest_expense = abs(isg("financeCosts"))

    cash = bsg("cashAndEquivalents")
    total_equity = bsg("totalEquity")
    current_debt = bsg("stBorrowingsData") + bsg("currentDebt")
    long_term_debt = bsg("ltDebtData")
    total_debt = current_debt + long_term_debt
    net_debt = total_debt - cash

    capex = abs(cfg("capitalExpenditures"))
    operating_cf = cfg("operatingCashFlow")

    # Tax rate
    tax_rate = _safe_div(income_tax_expense, income_before_tax) if income_before_tax else 0.25
    if tax_rate is None or tax_rate < 0 or tax_rate > 1:
        tax_rate = 0.25

    # NOPAT = EBIT × (1 − tax rate)
    nopat = operating_income * (1 - tax_rate)

    # Base FCF = NOPAT + D&A − estimated CapEx − estimated WC change
    wc_change = 0.0
    if prev_year:
        ca_curr = bsg("totalCurrentAssets")
        ca_prev = _get(bs_l, "totalCurrentAssets", prev_year)
        cl_curr = bsg("totalCurrentLiabilities")
        cl_prev = _get(bs_l, "totalCurrentLiabilities", prev_year)
        wc_change = (ca_curr - ca_prev) - (cl_curr - cl_prev)

    base_fcf = nopat + depreciation - capex - wc_change

    # ── Historical WACC ──────────────────────────────────────────
    # Cost of equity: use ROE as a proxy (Net Income / Total Equity)
    roe = _safe_div(net_income, total_equity) or 0.0
    cost_of_equity = roe  # simplified proxy; CAPM not implemented in v1

    # Cost of debt: Interest Expense / Total Debt
    cost_of_debt_pretax = _safe_div(interest_expense, total_debt) or 0.0
    cost_of_debt = cost_of_debt_pretax * (1 - tax_rate)  # after-tax

    # Weights
    total_capital = total_debt + total_equity
    equity_weight = _safe_div(total_equity, total_capital) or 0.0
    debt_weight   = _safe_div(total_debt, total_capital) or 0.0

    historical_wacc = (equity_weight * cost_of_equity) + (debt_weight * cost_of_debt)

    return {
        "latest_year":    latest_year,
        "base_fcf":       round(base_fcf, 2),
        "ebitda":         round(ebitda, 2),
        "net_debt":       round(net_debt, 2),
        "revenue":        round(revenue, 2),
        "net_income":     round(net_income, 2),
        "tax_rate":       round(tax_rate, 4),
        "wacc": {
            "historical_wacc":    round(historical_wacc * 100, 4),  # as percentage
            "cost_of_equity":     round(cost_of_equity * 100, 4),
            "cost_of_debt":       round(cost_of_debt * 100, 4),
            "equity_weight":      round(equity_weight * 100, 4),
            "debt_weight":        round(debt_weight * 100, 4),
            "calculation_note":   (
                f"Based on cost of equity (ROE: {cost_of_equity*100:.1f}%) "
                f"and cost of debt ({cost_of_debt_pretax*100:.1f}%)"
            ),
        },
    }
