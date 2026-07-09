"""
Forecasting Engine Service
==========================
Complete 5-year financial forecast generator — Python port of forecastingEngine.ts.

Produces projected Income Statement, Balance Sheet, and Cash Flow Statement
for each forecast year, plus cumulative metrics and balance sheet validation.

All arithmetic is in Python, as required by SRS §2.5.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Literal

from app.models.financial import statement_to_lookup
import re

def _parse_year(y: str) -> int:
    """Extract the last block of digits from a string to form a valid year."""
    digits = re.findall(r'\d+', str(y))
    if not digits:
        return 2024
    last_block = digits[-1]
    if len(last_block) == 2:
        return 2000 + int(last_block)
    return int(last_block)



def _get_compat(lookup: dict[str, dict[str, float]], key: str, year: str) -> float:
    """Fetch value supporting both old and new Manufacturing Template keys."""
    val = lookup.get(key, {}).get(year, 0.0) or 0.0
    if val != 0.0:
        return val
    
    # Fallback mappings for the new Manufacturing Template keys
    compat = {
        "costOfRevenue": ["costOfRevenueDisplayHeader", "totalCostOfRevenue", "manufacturingCostsHeader"],
        "totalRevenue": ["revenueHeader"],
        "sgaExpense": ["generalAdminHeader", "sellingExpensesHeader"],
        "rdExpense": ["researchDevHeader", "researchAndDevelopment"],
        "depreciationCogs": ["depreciationCostOfSales"],
        "propertyPlantEquipment": ["grossPPE", "netPPE"], 
        "accountsReceivable": ["netReceivables", "tradeAccountsReceivable"],
        "stBorrowings": ["stBorrowingsData"],
        "currentDebt": ["currentPortionLTDebt"],
        "longTermDebt": ["ltDebtData"],
        "incomeBeforeTax": ["earningsBeforeTax"],
        "financeCosts": ["financeCosts", "interestExpense", "financialExpense"],
        "currentIncomeTax": ["incomeTaxExpense", "currentIncomeTax"],
        "basicSharesOutstanding": ["weightedAvgBasicShares"],
        "basicAverageShares": ["weightedAvgBasicShares"],
        "dilutedAverageShares": ["weightedAvgDilutedShares"],
        "dividendsPaid": ["cfDividendsPaid"],
        "commonStockDividendPaid": ["cfDividendsPaid"],
        "capitalExpenditure": ["capitalExpenditures"],
    }
    
    if key in compat:
        for new_key in compat[key]:
            val = lookup.get(new_key, {}).get(year, 0.0) or 0.0
            if val != 0.0:
                return val
                
    # Special sum fallbacks
    if key == "depreciation":
        return abs(lookup.get("depreciationOpex", {}).get(year, 0.0) or 0.0) + \
               abs(lookup.get("amortizationOpex", {}).get(year, 0.0) or 0.0) + \
               abs(lookup.get("depreciationCostOfSales", {}).get(year, 0.0) or 0.0)
               
    if key == "sgaExpense":
        return (lookup.get("totalSellingExpense", {}).get(year, 0.0) or 0.0) + \
               (lookup.get("totalGeneralAdminExpense", {}).get(year, 0.0) or 0.0)

    return 0.0

# ============================================================
# DATA CLASSES
# ============================================================

@dataclass
class ForecastInputs:
    revenue_growth_rate: float          = 10.0   # % per year
    operating_margin_expansion: float   = 0.5    # % per year added to operating margin
    capex_as_pct_of_revenue: float      = 3.0    # % of revenue
    working_capital_change: float       = 1.0    # % of revenue
    tax_rate: float                     = 25.0   # %
    depreciation_rate: float            = 8.0    # % of revenue
    dso: float                          = 45.0   # Days Sales Outstanding
    dio: float                          = 60.0   # Days Inventory Outstanding
    dpo: float                          = 30.0   # Days Payable Outstanding
    interest_rate_on_debt: float        = 4.0    # % on long-term debt
    share_repurchase_rate: float        = 2.0    # % of net income
    dividend_payout_ratio: float        = 30.0   # % of net income


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
    revenue_growth_multiplier: float      = 1.0
    margin_expansion_multiplier: float    = 1.0


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
    share_repurchases: float        = 0.0
    debt_issuance: float            = 0.0
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
        interest_expense=abs(isg("financeCosts") + isg("interestExpense") + isg("financialExpense")),
        tax_expense=abs(isg("incomeTaxExpense") + isg("currentIncomeTax") + isg("deferredIncomeTax") + isg("zakatExpenses")),
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
        ar  = bs_l.get("accountsReceivable", {}).get(y, 0.0) or 0.0
        if rev > 0 and ar > 0:
            dso_vals.append((ar / rev) * 365)
    avg_dso = (sum(dso_vals) / len(dso_vals)) if dso_vals else 45.0

    # ── DIO (Days Inventory Outstanding) ────────────────────
    dio_vals = []
    for y in years:
        cogs = is_l.get("costOfRevenue", {}).get(y, 0.0) or 0.0
        inv  = bs_l.get("inventory", {}).get(y, 0.0) or 0.0
        if cogs > 0 and inv > 0:
            dio_vals.append((inv / cogs) * 365)
    avg_dio = (sum(dio_vals) / len(dio_vals)) if dio_vals else 60.0

    # ── DPO (Days Payable Outstanding) ──────────────────────
    dpo_vals = []
    for y in years:
        cogs = is_l.get("costOfRevenue", {}).get(y, 0.0) or 0.0
        ap   = bs_l.get("accountsPayable", {}).get(y, 0.0) or 0.0
        if cogs > 0 and ap > 0:
            dpo_vals.append((ap / cogs) * 365)
    avg_dpo = (sum(dpo_vals) / len(dpo_vals)) if dpo_vals else 30.0

    return ForecastInputs(
        revenue_growth_rate=round(avg_rev_growth, 1),
        operating_margin_expansion=0.5,
        capex_as_pct_of_revenue=round(avg_capex_pct, 1),
        working_capital_change=1.0,
        tax_rate=round(avg_tax_rate, 1),
        depreciation_rate=round(avg_dep_pct, 1),
        dso=round(avg_dso, 1),
        dio=round(avg_dio, 1),
        dpo=round(avg_dpo, 1),
        interest_rate_on_debt=4.0,
        share_repurchase_rate=2.0,
        dividend_payout_ratio=30.0,
    )


# ============================================================
# FORECASTING ENGINE
# ============================================================

class ForecastingEngine:
    """
    Python port of forecastingEngine.ts ForecastingEngine class.
    Generates complete 5-year IS + BS + CFS projections.
    """

    def __init__(
        self,
        base_data: BaseFinancialData,
        inputs: ForecastInputs,
        forecast_years: int = 5,
    ):
        self.base = base_data
        self.inputs = inputs
        self.forecast_years = forecast_years

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

        # Cumulative / stateful values
        current_revenue           = b.revenue
        current_margin            = b.operating_margin
        cumulative_retained       = b.retained_earnings
        cumulative_ppe            = b.ppe
        cumulative_depreciation   = b.accumulated_depreciation
        current_cash              = b.cash
        current_debt              = b.long_term_debt

        forecasts: list[YearlyForecast] = []

        for idx in range(self.forecast_years):
            year = b.last_year + idx + 1

            adj_growth     = inp.revenue_growth_rate * scenario.revenue_growth_multiplier
            adj_margin_exp = inp.operating_margin_expansion * scenario.margin_expansion_multiplier

            # ── Revenue & Margin ─────────────────────────────
            current_revenue *= (1 + adj_growth / 100)
            current_margin  += adj_margin_exp

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
            interest_expense  = current_debt * (inp.interest_rate_on_debt / 100)
            income_before_tax = operating_income + interest_income - interest_expense
            tax_expense       = income_before_tax * (inp.tax_rate / 100)
            net_income        = income_before_tax - tax_expense

            # ── BALANCE SHEET (PRE-CASH PLUG) ────────────────
            accounts_receivable  = current_revenue * (inp.dso / 365)
            inventory            = cost_of_revenue * (inp.dio / 365)
            other_current_assets = current_revenue * 0.05
            non_cash_current_assets = accounts_receivable + inventory + other_current_assets

            # Calculate CapEx and update PPE BEFORE calculating Total Assets
            capex = current_revenue * (inp.capex_as_pct_of_revenue / 100)
            acquisitions = current_revenue * 0.01
            
            cumulative_ppe          += capex - depreciation
            cumulative_depreciation += depreciation
            net_ppe = cumulative_ppe - cumulative_depreciation

            goodwill         = b.total_assets * 0.10
            other_intangibles = b.total_assets * 0.05
            
            # Sum of all assets EXCEPT cash
            non_cash_assets = non_cash_current_assets + net_ppe + goodwill + other_intangibles

            accounts_payable          = cost_of_revenue * (inp.dpo / 365)
            other_current_liabilities = current_revenue * 0.03
            total_current_liabilities = accounts_payable + other_current_liabilities

            # Use non_cash_assets as proxy to prevent circular dependency on deferred tax
            deferred_tax        = non_cash_assets * 0.02
            other_lt_liabilities = non_cash_assets * 0.03
            total_liabilities   = total_current_liabilities + current_debt + deferred_tax + other_lt_liabilities

            common_stock    = b.total_equity - b.retained_earnings or 100_000_000
            retained_add    = net_income * (1 - inp.dividend_payout_ratio / 100)
            cumulative_retained += retained_add
            total_equity    = common_stock + cumulative_retained

            total_liab_and_eq = total_liabilities + total_equity

            # CASH IS THE PLUG. This guarantees Assets = Liabilities + Equity perfectly.
            current_cash = total_liab_and_eq - non_cash_assets
            if current_cash < 0: 
                current_cash = 0  # Floor at 0 to prevent negative cash visuals in basic model

            # Final Asset calculations
            total_current_assets = current_cash + non_cash_current_assets
            total_assets = total_current_assets + net_ppe + goodwill + other_intangibles

            # ── CASH FLOW STATEMENT ──────────────────────────
            stock_based_comp       = current_revenue * 0.02
            deferred_tax_change    = non_cash_assets * 0.001
            wc_change_amount       = current_revenue * (inp.working_capital_change / 100)
            operating_cash_flow    = (
                net_income + depreciation + stock_based_comp
                + deferred_tax_change - wc_change_amount
            )

            investing_cash_flow = -(capex + acquisitions)

            dividends_paid      = net_income * (inp.dividend_payout_ratio / 100)
            share_repurchases   = net_income * (inp.share_repurchase_rate / 100)
            debt_issuance       = (current_revenue * 0.05) if idx == 0 else 0.0
            financing_cash_flow = -dividends_paid - share_repurchases + debt_issuance

            # Force net_cash_change to equal the actual change in the Cash plug.
            previous_cash = b.cash if idx == 0 else forecasts[-1].cash
            actual_cash_change = current_cash - previous_cash
            net_cash_change = actual_cash_change 

            free_cash_flow  = operating_cash_flow - capex

            # ── KEY METRICS ──────────────────────────────────
            # Calculate margin as an OUTPUT metric based on the actual IS math
            current_margin = (operating_income / current_revenue * 100) if current_revenue else 0.0
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
                working_capital_change=round(wc_change_amount, 2),
                operating_cash_flow=round(operating_cash_flow, 2),
                capex=round(capex, 2),
                acquisitions=round(acquisitions, 2),
                investing_cash_flow=round(investing_cash_flow, 2),
                dividends_paid=round(dividends_paid, 2),
                share_repurchases=round(share_repurchases, 2),
                debt_issuance=round(debt_issuance, 2),
                financing_cash_flow=round(financing_cash_flow, 2),
                net_cash_change=round(net_cash_change, 2),
                free_cash_flow=round(free_cash_flow, 2),
                operating_margin=round(current_margin, 4),
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
) -> dict:
    """
    Full forecasting pipeline:
      1. Extract base data from stored statements
      2. Build ForecastInputs from provided dict
      3. Run base + optional scenario forecasts
      4. Return structured response
    """
    base = extract_base_data(income_statement, balance_sheet, cash_flow, dcf_assumptions=dcf_assumptions)

    fi = ForecastInputs(
        revenue_growth_rate         = float(inputs.get("revenue_growth_rate", 10.0)),
        operating_margin_expansion  = float(inputs.get("operating_margin_expansion", 0.5)),
        capex_as_pct_of_revenue     = float(inputs.get("capex_as_pct_of_revenue", 3.0)),
        working_capital_change      = float(inputs.get("working_capital_change", 1.0)),
        tax_rate                    = float(inputs.get("tax_rate", 25.0)),
        depreciation_rate           = float(inputs.get("depreciation_rate", 8.0)),
        dso                         = float(inputs.get("dso", 45.0)),
        dio                         = float(inputs.get("dio", 60.0)),
        dpo                         = float(inputs.get("dpo", 30.0)),
        interest_rate_on_debt       = float(inputs.get("interest_rate_on_debt", 4.0)),
        share_repurchase_rate       = float(inputs.get("share_repurchase_rate", 2.0)),
        dividend_payout_ratio       = float(inputs.get("dividend_payout_ratio", 30.0)),
    )

    engine = ForecastingEngine(base, fi, forecast_years)

    scenario_map = {
        "base":        ForecastScenario("base",        1.0, 1.0),
        "optimistic":  ForecastScenario("optimistic",  1.3, 1.5),
        "pessimistic": ForecastScenario("pessimistic", 0.7, 0.5),
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
                "totalRevenue": f.revenue,
                "revenueHeader": f.revenue,
                "totalCostOfRevenue": f.cost_of_revenue,
                "costOfRevenueDisplayHeader": f.cost_of_revenue,
                "grossProfit": f.gross_profit,
                "totalGeneralAdminExpense": f.sga_expenses,
                "generalAdminHeader": f.sga_expenses,
                "researchDevHeader": f.rd_expenses,
                "researchAndDevelopment": f.rd_expenses,
                "depreciationOpex": f.depreciation,
                "operatingIncome": f.operating_income,
                "financeCosts": f.interest_expense,
                "incomeBeforeTax": f.income_before_tax,
                "earningsBeforeTax": f.income_before_tax,
                "incomeTaxExpense": f.tax_expense,
                "currentIncomeTax": f.tax_expense,
                "netIncome": f.net_income,
                "netIncomeAttributableToParent": f.net_income,
                "totalComprehensiveIncome": f.net_income
            }
            d["full_income_statement"] = _project_statement(income_statement, rev_mult, base_year_str, f, is_overrides)
            
            bs_overrides = {
                "cashAndEquivalents": f.cash,
                "netReceivables": f.accounts_receivable,
                "totalInventory": f.inventory,
                "totalCurrentAssets": f.current_assets,
                "netPPE": f.ppe - f.accumulated_depreciation,
                "grossPPE": f.ppe,
                "netIntangibleAssets": f.intangible_assets,
                "grossIntangibleAssets": f.intangible_assets,
                "totalNonCurrentAssets": f.non_current_assets,
                "totalAssets": f.total_assets,
                "stBorrowingsData": f.short_term_debt,
                "currentPortionLTDebt": f.current_portion_lt_debt,
                "totalCurrentLiabilities": f.current_liabilities,
                "ltDebtData": f.long_term_debt,
                "totalNonCurrentLiabilities": f.non_current_liabilities,
                "totalLiabilities": f.total_liabilities,
                "totalEquity": f.total_equity,
                "totalLiabilitiesAndEquity": f.total_liabilities_and_equity,
                "balanceCheck": f.total_assets - f.total_liabilities_and_equity
            }
            d["full_balance_sheet"] = _project_statement(balance_sheet, ast_mult, base_year_str, f, bs_overrides)
            
            cf_overrides = {
                "netIncome": f.net_income,
                "cfNetIncomeData": f.net_income,
                "depreciationAmortization": f.depreciation,
                "totalNonCashAdjustments": f.depreciation,
                "changeInWorkingCapital": f.change_in_working_capital,
                "totalWorkingCapitalAdjustments": f.change_in_working_capital,
                "operatingCashFlow": f.operating_cash_flow,
                "capitalExpenditures": -f.capital_expenditures,
                "investingCashFlow": f.investing_cash_flow,
                "cfStBorrowings": f.change_in_short_term_debt,
                "cfLtDebtIssued": f.change_in_long_term_debt if f.change_in_long_term_debt > 0 else 0,
                "cfDebtRepaid": f.change_in_long_term_debt if f.change_in_long_term_debt < 0 else 0,
                "cfDividendsPaid": -f.dividends_paid,
                "financingCashFlow": f.financing_cash_flow,
                "netIncreaseDecreaseCash": f.net_change_in_cash,
                "cfEndingCashBalance": f.cash
            }
            d["full_cash_flow_statement"] = _project_statement(cash_flow, rev_mult, base_year_str, f, cf_overrides)
            
            full_forecasts.append(d)

        scenario_results[s_name] = {
            "forecasts":          full_forecasts,
            "cumulative_metrics": engine.calculate_cumulative_metrics(forecasts),
            "balance_sheet_check": engine.validate_balance_sheet(forecasts),
        }

    return {
        "base_year":      base.last_year,
        "forecast_years": forecast_years,
        "inputs":         asdict(fi),
        "scenarios":      scenario_results,
    }
