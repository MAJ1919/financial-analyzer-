/**
 * Shared number formatters — the ONLY place display formatting lives.
 *
 * Conventions:
 *   - Invalid input (null, undefined, NaN, ±Infinity) always renders '—'
 *   - Full numbers (grids, statement tables): fmtNumber
 *   - Large standalone figures (KPI cards, valuation): fmtCompact / fmtCurrency
 *   - Ratio/percent displays: fmtPercent, fmtRatioValue
 */

const isBad = (n) => n == null || !isFinite(n)

/** Full locale number: 1234567.89 → "1,234,568" (decimals controls precision). */
export function fmtNumber(n, decimals = 0) {
  if (isBad(n)) return '—'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Abbreviated: 1_234_567 → "1.2M"; 12_500 → "12.5K"; 3.2e9 → "3.2B". */
export function fmtCompact(n, dp = 1) {
  if (isBad(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(dp)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(dp)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(dp)}K`
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

/** Abbreviated with currency suffix: → "1.2M SAR". */
export function fmtCurrency(n, currency = 'SAR', dp = 1) {
  if (isBad(n)) return '—'
  return `${fmtCompact(n, dp)} ${currency}`
}

/** "12.5%" — input is already in percent units (12.5, not 0.125). */
export function fmtPercent(n, dp = 1) {
  if (isBad(n)) return '—'
  return `${Number(n).toFixed(dp)}%`
}

/**
 * Ratio-table dispatcher, keyed by the backend's RATIO_DEFINITIONS format:
 *   'percent'  → value is a FRACTION (0.125 → "12.50%")
 *   'days'     → "45.20 d"
 *   'ratio'    → "1.25x"
 *   'currency' → "12.34"
 */
export function fmtRatioValue(value, format) {
  if (isBad(value)) return '—'
  const num = Number(value)
  switch (format) {
    case 'percent': return `${(num * 100).toFixed(2)}%`
    case 'days':    return `${num.toFixed(2)} d`
    case 'ratio':   return `${num.toFixed(2)}x`
    default:        return num.toFixed(2)
  }
}
