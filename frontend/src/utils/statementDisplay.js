/**
 * Shared statement-display rules used by FinancialGrid and the Forecasting
 * projections table — keep the two views visually identical.
 */

// Redundant aggregate rows removed from the canonical template: each one
// duplicated a computed header/subtotal (e.g. "Total Revenue" vs the
// "Revenue" header, which already totals its children). Projects saved
// before the removal still carry them in stored JSONB — projectStore
// filters them out on load so legacy data renders identically.
export const DEPRECATED_ROW_KEYS = new Set([
  // Income statement
  'totalRevenue',
  'totalCostOfRevenue',
  'totalSellingExpense',
  'totalGeneralAdminExpense',
  'totalOtherOperatingExpense',
  'operatingIncomeDisplayHeader',
  // Balance sheet
  'netReceivables',
  'totalInventory',
  'totalCurrentAssets',
  'netPPE',
  'netIntangibleAssets',
  'totalNonCurrentAssets',
  'totalAssets',
  'totalCurrentLiabilities',
  'totalNonCurrentLiabilities',
  'totalLiabilities',
  'totalEquity',
  // Cash flow statement
  'operatingCashFlow',
  'investingCashFlow',
  'financingCashFlow',
  'totalNonCashAdjustments',
  'totalWorkingCapitalAdjustments',
])

// Pure-label section headers: rows that group children but hold no value
// of their own, so their cells render blank.
export const HIDDEN_HEADER_KEYS = new Set([
  'earningsPerShareHeader',
  'sharesOutstandingHeader',
  'supplementalMetricsHeader',
  'comprehensiveIncomeHeader',
  'receivablesChangeHeader',
  'inventoryChangeHeader',
  'otherCurrentAssetsChangeHeader',
  'payablesChangeHeader',
  'otherLiabilitiesChangeHeader',
  'otherOperatingActivitiesHeader',
  'borrowingsHeader',
  'debtRepaymentsHeader',
  'shareholderReturnsHeader',
  'otherFinancingActivitiesHeader',
  'cashReconciliationHeader',
  'supplementalDisclosureHeader',
])

/** True when a header row's value cells should render empty. */
export function isHiddenHeaderRow(row) {
  return !!row?.is_header && !row?.is_subtotal && HIDDEN_HEADER_KEYS.has(row?.key)
}

/**
 * Normalize a row's hierarchy level for styling:
 * subtotals are always level 1, headers cap at level 2, leaves default to 3.
 */
export function resolveRowLevel(row) {
  let level = row?.level || (row?.is_subtotal ? 1 : row?.is_header ? 2 : 3)
  if (row?.is_subtotal) level = 1
  else if (row?.is_header && level > 2) level = 2
  return level
}
