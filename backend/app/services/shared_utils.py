"""
Shared Financial Data Utilities
===============================
Single source of truth for helpers used by BOTH `analysis_engine.py` and
`forecasting_engine.py`. These were previously duplicated (and had drifted)
in each engine — any change to key-compatibility mappings must be made HERE
and nowhere else.

Contents:
  - _parse_year()     → normalize year strings ("FY21", "2023") to int
  - KEY_COMPAT_MAP    → legacy key → Manufacturing Template key fallbacks
  - _get_compat()     → lookup fetch with compat fallbacks + sum fallbacks
  - _build_lookups()  → stored JSONB statements → flat key→{year→value} dicts
"""

from __future__ import annotations
import re


def _parse_year(y: str) -> int:
    """Extract the last block of digits from a string to form a valid year.

    Examples: "2023" → 2023, "FY21" → 2021, "Year 2022" → 2022.
    Falls back to 2024 when no digits are present.
    """
    digits = re.findall(r"\d+", str(y))
    if not digits:
        return 2024
    last_block = digits[-1]
    if len(last_block) == 2:
        return 2000 + int(last_block)
    return int(last_block)


# ---------------------------------------------------------------------------
# Key compatibility map
# ---------------------------------------------------------------------------
# Maps a legacy/canonical key → ordered list of Manufacturing Template keys
# to try when the primary key holds no (non-zero) value.
#
# This is the UNION of the maps that previously lived separately in
# analysis_engine and forecasting_engine, so ratios and forecasts now
# resolve line items identically. Order matters: first non-zero hit wins.
KEY_COMPAT_MAP: dict[str, list[str]] = {
    # ── Income Statement ────────────────────────────────────────────────
    "revenue":                 ["revenueHeader", "totalRevenue"],
    "totalRevenue":            ["revenueHeader"],
    "costOfRevenue":           ["costOfRevenueDisplayHeader", "totalCostOfRevenue", "manufacturingCostsHeader"],
    "grossProfit":             ["grossProfitHeader"],
    "operatingIncome":         ["operatingIncomeDisplayHeader"],
    "incomeBeforeTax":         ["earningsBeforeTax"],
    "interestExpense":         ["financeCosts", "financialExpense"],
    "interestExpenseNet":      ["financeCosts", "financialExpense"],
    "currentIncomeTax":        ["incomeTaxExpense"],
    "rdExpense":               ["researchDevHeader", "researchAndDevelopment"],
    "depreciationCogs":        ["depreciationCostOfSales"],
    # NOTE: compat returns the FIRST non-zero hit only; the summed
    # selling + G&A case is handled by the sum fallback in _get_compat().
    "sgaExpense":              ["generalAdminHeader", "sellingExpensesHeader"],

    # ── Balance Sheet ───────────────────────────────────────────────────
    "propertyPlantEquipment":  ["ppeHeader", "grossPPE", "netPPE"],
    "accountsReceivable":      ["receivablesHeader", "netReceivables", "tradeAccountsReceivable"],
    "inventory":               ["inventoryHeader", "totalInventory"],
    "totalInventory":          ["inventoryHeader"],
    "tradePayables":           ["tradePayablesHeader"],
    "totalCurrentAssets":      ["currentAssetsHeader"],
    "totalAssets":             ["assetsHeader"],
    "totalCurrentLiabilities": ["currentLiabilitiesHeader"],
    "totalLiabilities":        ["liabilitiesHeader"],
    "totalEquity":             ["equityHeader"],
    "stBorrowings":            ["stBorrowingsData"],
    "currentDebt":             ["currentPortionLTDebt"],
    "longTermDebt":            ["ltDebtData"],
    "accountsPayable":         ["tradePayablesHeader"],

    # ── Shares / Dividends ──────────────────────────────────────────────
    "basicSharesOutstanding":  ["weightedAvgBasicShares"],
    "basicAverageShares":      ["weightedAvgBasicShares"],
    "dilutedAverageShares":    ["weightedAvgDilutedShares"],
    "dividendsPaid":           ["cfDividendsPaid"],
    "commonStockDividendPaid": ["cfDividendsPaid"],

    # ── Cash Flow ───────────────────────────────────────────────────────
    "capitalExpenditure":      ["capitalExpenditures"],
    "operatingCashFlow":       ["operatingActivitiesHeader"],
}


def _get_compat(lookup: dict[str, dict[str, float]], key: str, year: str) -> float:
    """Fetch a value for `key`/`year`, falling back through KEY_COMPAT_MAP.

    Resolution order:
      1. Direct hit on `key` (non-zero).
      2. Each compat key in KEY_COMPAT_MAP[key], first non-zero wins.
      3. Special sum fallbacks for aggregate concepts (depreciation, SG&A).
      4. 0.0
    """
    val = lookup.get(key, {}).get(year, 0.0) or 0.0
    if val != 0.0:
        return val

    for compat_key in KEY_COMPAT_MAP.get(key, ()):
        val = lookup.get(compat_key, {}).get(year, 0.0) or 0.0
        if val != 0.0:
            return val

    # ── Special sum fallbacks ───────────────────────────────────────────
    # "depreciation" = all D&A components across COGS and OpEx
    if key == "depreciation":
        return abs(lookup.get("depreciationOpex", {}).get(year, 0.0) or 0.0) + \
               abs(lookup.get("amortizationOpex", {}).get(year, 0.0) or 0.0) + \
               abs(lookup.get("depreciationCostOfSales", {}).get(year, 0.0) or 0.0)

    # "sgaExpense" = selling + G&A totals when granular totals exist
    if key == "sgaExpense":
        return (lookup.get("totalSellingExpense", {}).get(year, 0.0) or 0.0) + \
               (lookup.get("totalGeneralAdminExpense", {}).get(year, 0.0) or 0.0)

    return 0.0


def _build_lookups(
    income_statement: dict | None,
    balance_sheet: dict | None,
    cash_flow: dict | None = None,
) -> tuple[
    dict[str, dict[str, float]],
    dict[str, dict[str, float]],
    dict[str, dict[str, float]],
]:
    """Convert stored JSONB statement dicts to flat key→{year→value} lookups."""
    # Local import to avoid a circular dependency (models ↔ services).
    from app.models.financial import statement_to_lookup

    return (
        statement_to_lookup(income_statement),
        statement_to_lookup(balance_sheet),
        statement_to_lookup(cash_flow) if cash_flow else {},
    )
