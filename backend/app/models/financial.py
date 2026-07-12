"""
Financial data models (Pydantic) + Line Item Key Mapping.

Storage model (JSONB in Supabase):
  FinancialStatement.rows  — display-ordered list of FinancialRow objects
  FinancialRow.values      — {year: value} per line item

Computation model (used by analysis_engine.py):
  A flat dict of {lineItemKey: {year: value}} derived from the row model via
  `statement_to_lookup()`.  Line item keys are camelCase canonical names
  matching the old project's ratioCalculations service.
"""
from pydantic import BaseModel
from typing import Optional, Any


# ---------------------------------------------------------------------------
# Canonical line item key mapping
# Maps Excel/display label → camelCase key used by the analysis engine.
# Extend this dict as new client files reveal additional label variants.
# ---------------------------------------------------------------------------
LABEL_TO_KEY: dict[str, str] = {
    # ── Income Statement ─────────────────────────────────────────
    "Revenue":                    "totalRevenue",
    "Total Revenue":              "totalRevenue",
    "Net Revenue":                "totalRevenue",
    "Sales":                      "totalRevenue",
    "Net Sales":                  "totalRevenue",

    "Cost of Revenue":            "costOfRevenue",
    "Cost of Goods Sold":         "costOfRevenue",
    "COGS":                       "costOfRevenue",
    "Cost of Sales":              "costOfRevenue",

    "Gross Profit":               "grossProfit",
    "Gross Income":               "grossProfit",

    "Selling, General & Admin":   "sgaExpense",
    "SG&A":                       "sgaExpense",
    "General & Admin Expense":    "sgaExpense",

    "Research & Development":     "rdExpense",
    "R&D":                        "rdExpense",

    "Operating Expenses":         "totalOperatingExpenses",
    "Total Operating Expenses":   "totalOperatingExpenses",
    "OpEx":                       "totalOperatingExpenses",

    "Operating Income":           "operatingIncome",
    "EBIT":                       "operatingIncome",
    "Income from Operations":     "operatingIncome",
    "Operating Profit":           "operatingIncome",

    "EBITDA":                     "ebitda",

    "Depreciation & Amortization": "depreciation",
    "D&A":                        "depreciation",
    "Depreciation":               "depreciation",
    "Amortization":               "depreciation",

    "Interest Expense":           "interestExpense",
    "Finance Costs":              "interestExpense",

    "Interest Income":            "interestIncome",

    "Income Before Tax":          "incomeBeforeTax",
    "Pre-tax Income":             "incomeBeforeTax",
    "EBT":                        "incomeBeforeTax",

    "Income Tax Expense":         "incomeTaxExpense",
    "Tax Provision":              "incomeTaxExpense",
    "Taxes":                      "incomeTaxExpense",

    "Net Income":                 "netIncome",
    "Net Profit":                 "netIncome",
    "Profit for the Year":        "netIncome",
    "Net Earnings":               "netIncome",

    "Shares Outstanding":         "basicSharesOutstanding",
    "Basic Shares Outstanding":   "basicSharesOutstanding",
    "Diluted Shares Outstanding": "dilutedAverageShares",

    # ── Balance Sheet — Assets ───────────────────────────────────
    "Cash and Cash Equivalents":  "cashAndEquivalents",
    "Cash & Cash Equivalents":    "cashAndEquivalents",
    "Cash":                       "cashAndEquivalents",

    "Short-term Investments":     "shortTermInvestments",

    "Accounts Receivable":        "accountsReceivable",
    "Trade Receivables":          "accountsReceivable",
    "Receivables":                "accountsReceivable",
    "Debtors":                    "accountsReceivable",

    "Inventory":                  "inventory",
    "Inventories":                "inventory",
    "Stock":                      "inventory",

    "Prepaid Expenses":           "prepaidExpenses",

    "Other Current Assets":       "otherCurrentAssets",

    "Total Current Assets":       "totalCurrentAssets",
    "Current Assets":             "totalCurrentAssets",

    "Property, Plant & Equipment":"propertyPlantEquipment",
    "PP&E":                       "propertyPlantEquipment",
    "Net PP&E":                   "propertyPlantEquipment",

    "Intangible Assets":          "intangibleAssets",
    "Goodwill":                   "goodwill",

    "Long-term Investments":      "longTermInvestments",

    "Other Non-current Assets":   "otherNonCurrentAssets",

    "Total Non-current Assets":   "totalNonCurrentAssets",
    "Non-current Assets":         "totalNonCurrentAssets",

    "Total Assets":               "totalAssets",

    # ── Balance Sheet — Liabilities ─────────────────────────────
    "Accounts Payable":           "accountsPayable",
    "Trade Payables":             "accountsPayable",
    "Creditors":                  "accountsPayable",

    "Short-term Debt":            "currentDebt",
    "Current Portion of LT Debt": "currentDebt",

    "Accrued Liabilities":        "accruedLiabilities",
    "Other Current Liabilities":  "otherCurrentLiabilities",

    "Total Current Liabilities":  "totalCurrentLiabilities",
    "Current Liabilities":        "totalCurrentLiabilities",

    "Long-term Debt":             "longTermDebt",
    "Long Term Debt":             "longTermDebt",

    "Deferred Tax Liabilities":   "deferredTaxLiabilities",
    "Other Non-current Liabilities": "otherNonCurrentLiabilities",

    "Total Non-current Liabilities": "totalNonCurrentLiabilities",
    "Non-current Liabilities":    "totalNonCurrentLiabilities",

    "Total Liabilities":          "totalLiabilities",

    # ── Balance Sheet — Equity ───────────────────────────────────
    "Common Stock":               "commonStock",
    "Share Capital":              "commonStock",

    "Retained Earnings":          "retainedEarnings",

    "Total Equity":               "totalEquity",
    "Shareholders Equity":        "totalEquity",
    "Stockholders Equity":        "totalEquity",
    "Total Shareholders Equity":  "totalEquity",

    "Total Liabilities & Equity": "totalLiabilitiesAndEquity",

    # ── Cash Flow Statement ──────────────────────────────────────
    "Operating Cash Flow":        "operatingCashFlow",
    "Cash from Operations":       "operatingCashFlow",
    "Net Cash from Operating":    "operatingCashFlow",

    "Capital Expenditures":       "capitalExpenditure",
    "CapEx":                      "capitalExpenditure",
    "Purchases of PP&E":          "capitalExpenditure",

    "Free Cash Flow":             "freeCashFlow",

    "Investing Cash Flow":        "investingCashFlow",
    "Cash from Investing":        "investingCashFlow",

    "Financing Cash Flow":        "financingCashFlow",
    "Cash from Financing":        "financingCashFlow",

    "Dividends Paid":             "dividendsPaid",

    "Net Change in Cash":         "netChangeInCash",
}

# Reverse mapping: canonical key → display label (first match wins)
KEY_TO_LABEL: dict[str, str] = {}
for _label, _key in LABEL_TO_KEY.items():
    if _key not in KEY_TO_LABEL:
        KEY_TO_LABEL[_key] = _label


def label_to_key(label: str) -> str:
    """Convert a display label to a camelCase canonical key. Returns label as-is if unknown."""
    return LABEL_TO_KEY.get(label, label)


# ---------------------------------------------------------------------------
# Internal Row Model  (SRS §7.2)
# ---------------------------------------------------------------------------

class FinancialRow(BaseModel):
    """
    Represents a single line item in a financial statement.
    Values are stored per-year, keyed by fiscal year string (e.g. "2022").
    """
    row_id: str                           # Unique identifier
    label: str                            # Display name (e.g. "Revenue")
    key: Optional[str] = None            # Canonical camelCase key (e.g. "totalRevenue")
    section: str                          # Section grouping
    level: int = 3                        # Hierarchy level (1 = highest)
    is_subtotal: bool = False
    is_header: bool = False
    industry: str = "general"
    values: dict[str, Optional[float]]   # {"2022": 1000000.0, "2023": 1200000.0}
    order: int = 0


class FinancialStatement(BaseModel):
    """
    Wrapper for a full financial statement (IS or BS).
    """
    years: list[str]
    rows: list[FinancialRow]


def statement_to_lookup(statement: dict | None) -> dict[str, dict[str, float]]:
    """
    Convert a stored FinancialStatement dict into a flat lookup:
        { camelCaseKey: { "2021": 1000.0, "2022": 1200.0 } }

    This is the format consumed by the analysis engine for ratio calculations,
    matching the structure used in the reference ratioCalculations.ts.
    """
    if not statement or "rows" not in statement:
        return {}

    lookup: dict[str, dict[str, float]] = {}
    for row in statement["rows"]:
        raw_label = row.get("label", "")
        # Use the stored key if available, otherwise derive from label
        key = row.get("key") or label_to_key(raw_label)
        values = {
            year: float(v) if v is not None else 0.0
            for year, v in (row.get("values") or {}).items()
        }
        lookup[key] = values
    return lookup


# ---------------------------------------------------------------------------
# Excel Mapping Models (used in the upload flow)
# ---------------------------------------------------------------------------


class ManualEntryPayload(BaseModel):
    """
    Used for direct manual entry ingestion path.
    """
    income_statement: Optional[FinancialStatement] = None
    balance_sheet: Optional[FinancialStatement] = None
    cash_flow_statement: Optional[FinancialStatement] = None
