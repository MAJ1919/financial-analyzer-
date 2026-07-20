import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useProjectStore } from '../../store/projectStore'
import Header from '../../components/layout/Header'
import { projectsApi, analysisApi } from '../../services/api'
import { fmtMoney, fmtPercent, unitLabel } from '../../utils/formatters'

// ============================================================
// DCF Formula Engine — port of dcfValuation.ts DCFValuationEngine
// Runs 100% on the frontend for <100ms responsiveness (SRS §6.1)
// ============================================================

/**
 * Fallback FCF projection: grow baseFCF by min(TGR * 1.5, 8%).
 *
 * This is a crude placeholder and is only used when no forecast has been run.
 * It ignores every real driver (tax rate, CapEx%, DSO/DIO/DPO), which is why
 * `extractForecastFCFs` below is preferred whenever a saved forecast exists.
 */
function projectFCFs(baseFCF, tgr, years) {
  const fcfGrowthRate = Math.min((tgr / 100) * 1.5, 0.08)
  const fcfs = []
  let fcf = baseFCF
  for (let i = 0; i < years; i++) {
    fcf *= (1 + fcfGrowthRate)
    fcfs.push(fcf)
  }
  return fcfs
}

/**
 * Pull the explicit per-year FCFs out of the last saved 5-year forecast.
 *
 * Shape (see forecasting_engine.run_forecast):
 *   forecast_data.scenarios.<scenario>.forecasts[] -> { year, free_cash_flow, ebitda }
 *
 * Returns null when no usable forecast is stored, so the caller can fall back.
 * Statement saves clear `forecast_data` (stale-forecast guard), so this
 * naturally reverts to the heuristic until the user re-runs the forecast.
 */
function extractForecastFCFs(forecastData, scenario = 'base') {
  const forecasts = forecastData?.scenarios?.[scenario]?.forecasts
  if (!Array.isArray(forecasts) || forecasts.length === 0) return null

  const rows = forecasts
    .filter((f) => f && Number.isFinite(Number(f.free_cash_flow)))
    .sort((a, b) => Number(a.year) - Number(b.year))
  if (rows.length === 0) return null

  return {
    fcfs:  rows.map((f) => Number(f.free_cash_flow)),
    // Terminal-year EBITDA straight from the model — no growth assumption needed.
    terminalEbitda: Number(rows[rows.length - 1].ebitda) || null,
    years: rows.map((f) => Number(f.year)),
  }
}

function computeDCF({
  baseFCF, ebitda, wacc, terminalGrowthRate, netDebt,
  sharesOutstanding, valuationMethod, exitMultiple, forecastYears,
  forecastSeries,
}) {
  if (!wacc || wacc <= 0 || wacc >= 100) return null
  if (valuationMethod === 'perpetuity' && terminalGrowthRate >= wacc) return null

  const waccRate = wacc / 100
  const tgRate   = terminalGrowthRate / 100
  const fcfGrowthRate = Math.min((tgRate) * 1.5, 0.08) // Used for EBITDA projection

  // Prefer the forecasting engine's actual FCFs; fall back to the heuristic.
  const modelled = forecastSeries?.fcfs?.length ? forecastSeries.fcfs : null
  if (!modelled && baseFCF == null) return null

  let fcfs
  if (modelled) {
    fcfs = modelled.slice(0, forecastYears)
    // Forecast shorter than the DCF horizon: extend from its last year so the
    // discounting period still lines up with forecastYears.
    if (fcfs.length < forecastYears) {
      let last = fcfs[fcfs.length - 1]
      while (fcfs.length < forecastYears) {
        last *= (1 + fcfGrowthRate)
        fcfs.push(last)
      }
    }
  } else {
    fcfs = projectFCFs(baseFCF, terminalGrowthRate, forecastYears)
  }

  // Present value of each FCF
  const pvFCFs = fcfs.map((fcf, i) => fcf / Math.pow(1 + waccRate, i + 1))
  const totalPVFCF = pvFCFs.reduce((a, b) => a + b, 0)

  // Terminal value
  const lastFCF = fcfs[fcfs.length - 1]
  let terminalValue
  if (valuationMethod === 'multiple') {
    // Apply Exit Multiple to TERMINAL YEAR EBITDA, not Base Year EBITDA —
    // applying it to the base year severely underestimates the company's value.
    // When a forecast exists, take its final-year EBITDA directly rather than
    // growing the base year by the heuristic rate.
    const terminalYearEbitda = modelled && forecastSeries?.terminalEbitda != null
      ? forecastSeries.terminalEbitda
      : (ebitda || 0) * Math.pow(1 + fcfGrowthRate, forecastYears)
    terminalValue = terminalYearEbitda * (exitMultiple || 0)
  } else {
    const termFCF = lastFCF * (1 + tgRate)
    terminalValue = termFCF / (waccRate - tgRate)
  }
  const pvTerminal = terminalValue / Math.pow(1 + waccRate, forecastYears)

  const enterpriseValue = totalPVFCF + pvTerminal
  const equityValue     = enterpriseValue - (netDebt || 0)
  const valuePerShare   = sharesOutstanding > 0 ? equityValue / sharesOutstanding : null

  return {
    fcfs,
    pvFCFs,
    totalPVFCF:      Math.round(totalPVFCF),
    pvTerminal:      Math.round(pvTerminal),
    terminalValue:   Math.round(terminalValue),
    enterpriseValue: Math.round(enterpriseValue),
    equityValue:     Math.round(equityValue),
    valuePerShare,
    // Which FCF series actually drove this valuation — surfaced in the UI so the
    // number is never silently based on the placeholder growth curve.
    fcfSource: modelled ? 'forecast' : 'heuristic',
    terminalValueMethod: valuationMethod === 'multiple'
      ? `Exit Multiple (${exitMultiple}× Terminal EBITDA)`
      : `Perpetuity Growth (${terminalGrowthRate}%)`,
  }
}

/**
 * Build sensitivity grid.
 * Perpetuity mode:  WACC (cols) × Terminal Growth Rate (rows)
 * Exit multiple:    WACC (cols) × Exit Multiple (rows)
 *
 * Limits:
 *  - WACC range: baseWACC ± 2% in 0.5% steps (always 9 columns, no hard clamp)
 *  - TGR range:  baseTGR ± 1.5% in 0.25% steps, filtered to stay below WACC − 0.25%
 *  - Exit range: baseMultiple ± 4× in 1× steps (always up to 9 rows)
 */
function buildSensitivityGrid(baseWACC, baseTGR, baseMultiple, params) {
  // ── WACC axis (always 9 cols centred on baseWACC) ─────────────────
  const waccRange = []
  for (let i = -4; i <= 4; i++) {
    const v = Number((baseWACC + i * 0.5).toFixed(1))
    if (v > 0) waccRange.push(v)
  }

  if (params.valuationMethod === 'multiple') {
    // ── Exit Multiple mode: rows = exit multiple ───────────────────
    const exitRange = []
    for (let i = -4; i <= 4; i++) {
      const v = Number((baseMultiple + i * 1).toFixed(1))
      if (v > 0) exitRange.push(v)
    }
    const grid = exitRange.map(em =>
      waccRange.map(w => {
        const r = computeDCF({ ...params, wacc: w, exitMultiple: em })
        return r?.valuePerShare ?? null
      })
    )
    return { waccRange, tgrRange: exitRange, grid, mode: 'multiple' }
  }

  // ── Perpetuity mode: rows = TGR ────────────────────────────────
  const minWACC = Math.min(...waccRange)
  const tgrRange = []
  for (let i = -6; i <= 6; i++) {
    const v = Number((baseTGR + i * 0.25).toFixed(2))
    // TGR must be < WACC − 0.25% to keep Gordon Growth valid; allow negative TGR
    if (v < minWACC - 0.25) tgrRange.push(v)
  }
  const grid = tgrRange.map(tgr =>
    waccRange.map(w => {
      const r = computeDCF({ ...params, wacc: w, terminalGrowthRate: tgr })
      return r?.valuePerShare ?? null
    })
  )
  return { waccRange, tgrRange, grid, mode: 'perpetuity' }
}

// ============================================================
// Component
// ============================================================
export default function Valuation() {
  const { projectId } = useParams()
  const project = useProjectStore((s) => s.project)

  const currency = project?.currency || 'SAR'
  // Assumptions are only persisted after the USER changes one — without this
  // guard the debounce effect wrote default values to the DB on every visit.
  const dirtyRef = useRef(false)

  // ── Assumptions (user-editable, auto-saved) ───────────────
  const [wacc, setWacc]                = useState(10)
  const [terminalGrowthRate, setTGR]   = useState(2.5)
  const [sharesOutstanding, setShares] = useState('')
  const [valuationMethod, setMethod]   = useState('perpetuity')  // 'perpetuity' | 'multiple'
  const [exitMultiple, setExitMultiple] = useState(12.0)
  const [forecastPeriod]               = useState(5)

  // ── Base metrics loaded from backend ─────────────────────
  const [baseMetrics, setBaseMetrics] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savedMsg, setSavedMsg]       = useState('')

  // ── Sensitivity analysis toggle ───────────────────────────
  const [showSensitivity, setShowSensitivity] = useState(false)

  // Load saved assumptions + base metrics on mount
  useEffect(() => {
    if (!projectId) return

    // Load DCF base metrics from backend
    analysisApi.getDcfMetrics(projectId)
      .then(setBaseMetrics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [projectId])

  // Restore saved assumptions from project
  useEffect(() => {
    if (project?.dcf_assumptions) {
      const a = project.dcf_assumptions
      if (a.wacc !== undefined)              setWacc(a.wacc)
      if (a.terminal_growth_rate !== undefined) setTGR(a.terminal_growth_rate)
      if (a.shares_outstanding !== undefined) setShares(a.shares_outstanding)
      // Previously never persisted, so these silently reset to
      // 'perpetuity' / 12.0 on every reload and quietly changed the valuation.
      if (a.valuation_method !== undefined)  setMethod(a.valuation_method)
      if (a.exit_multiple !== undefined)     setExitMultiple(a.exit_multiple)
    }
    // Pre-fill shares from base metrics if not saved
    if (baseMetrics && !project?.dcf_assumptions?.shares_outstanding) {
      // shares from income statement would come through baseMetrics in future
    }
  }, [project, baseMetrics])

  // Auto-save assumptions (800ms debounce) — only after a user edit
  useEffect(() => {
    if (!dirtyRef.current) return
    const timer = setTimeout(() => {
      const assumptions = {
        wacc,
        terminal_growth_rate: terminalGrowthRate,
        shares_outstanding: sharesOutstanding,
        net_debt: baseMetrics?.net_debt || 0,
        valuation_method: valuationMethod,
        exit_multiple: exitMultiple,
      }
      setSaving(true)
      projectsApi.update(projectId, { dcf_assumptions: assumptions })
        .then(() => { setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 2000) })
        .catch(console.error)
        .finally(() => setSaving(false))
    }, 800)
    return () => clearTimeout(timer)
  }, [wacc, terminalGrowthRate, sharesOutstanding, valuationMethod, exitMultiple,
      projectId, baseMetrics])

  // ── Build projected FCF series from base FCF + WACC growth ─
  // Fallback to deriving metrics directly from the latest manual statement data
  const getManualVal = (stmtType, key) => {
    if (!project || !project[stmtType] || !project[stmtType].years) return 0;
    const years = project[stmtType].years;
    if (years.length === 0) return 0;
    const latestYear = Math.max(...years.map(Number));
    const row = project[stmtType].rows.find(r => r.key === key);
    return row && row.values[latestYear] != null ? Number(row.values[latestYear]) : 0;
  };

  // operatingActivitiesHeader is the computed OCF total (the standalone
  // operatingCashFlow row was removed as a redundant duplicate)
  const manualBaseFCF = getManualVal('cash_flow_statement', 'operatingActivitiesHeader') + getManualVal('cash_flow_statement', 'capitalExpenditures');
  const manualEbitda = getManualVal('income_statement', 'ebitda');
  const manualNetDebt = getManualVal('balance_sheet', 'stBorrowingsData') + getManualVal('balance_sheet', 'currentPortionLTDebt') + getManualVal('balance_sheet', 'ltDebtData') - getManualVal('balance_sheet', 'cashAndEquivalents');

  const baseFCF   = baseMetrics?.base_fcf || manualBaseFCF || 0
  const netDebt   = baseMetrics?.net_debt ?? project?.dcf_assumptions?.net_debt ?? manualNetDebt ?? 0
  const ebitda    = baseMetrics?.ebitda   || manualEbitda || 0

  // ── Per-year FCFs from the last saved 5-year forecast ─────
  // Reading the stored forecast keeps the DCF frontend-only (<100ms, SRS §6.1)
  // while still honouring the engine's real drivers — tax rate, CapEx%,
  // DSO/DIO/DPO — instead of the placeholder growth curve.
  const forecastSeries = extractForecastFCFs(project?.forecast_data)

  // ── DCF computation (instant, frontend only) ─────────────
  const dcfParams = {
    baseFCF, ebitda, wacc, terminalGrowthRate,
    netDebt, sharesOutstanding, valuationMethod, exitMultiple,
    forecastYears: forecastPeriod, forecastSeries,
  }
  const result = computeDCF(dcfParams)
  const usingForecast = result?.fcfSource === 'forecast'

  // ── Sensitivity grid (WACC ±2% × TGR/multiple rows) ──────
  const sensitivity = buildSensitivityGrid(wacc, terminalGrowthRate, exitMultiple, dcfParams)
  // Colour-scale anchor, computed once (was re-derived per cell)
  const sensitivityMax = Math.max(...sensitivity.grid.flat().filter(v => v != null && v > 0), 1)

  return (
    <>
      <Header
        title="Valuation — DCF Model"
        subtitle={project?.company_name}
        actions={
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {saving ? 'Saving...' : savedMsg || 'Auto-saved'}
          </span>
        }
      />
      <div className="page-body">

        {/* Reporting-unit banner — all money figures are in thousands */}
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          All monetary figures in <strong>{unitLabel(currency)}</strong> (thousands).
          Enter <strong>Shares Outstanding in thousands</strong> too — value per share is then per actual share.
        </p>

        {/* ── Top 3 KPI Cards ─────────────────────────────── */}
        <div style={styles.kpiRow}>
          <KpiCard
            label="Enterprise Value"
            value={fmtMoney(result?.enterpriseValue, currency)}
            color="#1E3A8A"
            bg="rgba(30,58,138,0.06)"
          />
          <KpiCard
            label="Equity Value"
            value={fmtMoney(result?.equityValue, currency)}
            color="#475569"
            bg="rgba(71,85,105,0.06)"
          />
          <KpiCard
            label="Value per Share"
            value={result?.valuePerShare != null
              ? `${Number(result.valuePerShare).toFixed(2)} ${currency}`
              : sharesOutstanding === 0 ? 'Enter shares' : '—'}
            color="#4D7C0F"
            bg="rgba(77,124,15,0.06)"
          />
        </div>

        {/* ── Where the projected FCFs came from ───────────
            The heuristic ignores tax rate, CapEx% and working-capital
            assumptions, so the user must be able to tell the two apart. */}
        <div
          className="card"
          style={{
            marginBottom: 16,
            borderLeftWidth: 3,
            borderLeftStyle: 'solid',
            borderLeftColor: usingForecast ? 'var(--color-success)' : 'var(--color-warning)',
          }}
        >
          <div className="card-body" style={{ padding: '10px 16px', fontSize: 12 }}>
            {usingForecast ? (
              <>
                <span className="badge badge-success">Forecast-driven</span>
                <span className="text-muted" style={{ marginLeft: 10 }}>
                  Projected cash flows come from the saved {forecastSeries.fcfs.length}-year
                  forecast{forecastSeries.years?.length
                    ? ` (${forecastSeries.years[0]}–${forecastSeries.years[forecastSeries.years.length - 1]})`
                    : ''}, so tax rate, CapEx% and working-capital assumptions flow through.
                </span>
              </>
            ) : (
              <>
                <span className="badge badge-warning">Estimated</span>
                <span className="text-muted" style={{ marginLeft: 10 }}>
                  No saved forecast — cash flows use a placeholder growth curve
                  (min(TGR&nbsp;×&nbsp;1.5,&nbsp;8%)) that ignores tax rate, CapEx% and
                  working-capital drivers. Run the forecast for a model-driven valuation.
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Key Assumptions + Valuation Components ─────── */}
        <div style={styles.twoCol}>
          {/* Left — Key Assumptions */}
          <div className="card">
            <div className="card-header"><span className="card-title">Key Assumptions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <AssumptionRow label="WACC">
                <input
                  id="wacc-input"
                  type="number" step="0.1" min="0" max="100"
                  style={styles.inlineInput}
                  value={wacc}
                  onChange={(e) => { dirtyRef.current = true; setWacc(parseFloat(e.target.value) || 0) }}
                />
                <span style={{ fontSize: 14 }}>%</span>
              </AssumptionRow>
              <AssumptionRow label="Method">
                <select
                  id="method-select"
                  value={valuationMethod}
                  onChange={(e) => { dirtyRef.current = true; setMethod(e.target.value) }}
                  style={{ ...styles.inlineInput, width: 'auto' }}
                >
                  <option value="perpetuity">Perpetuity Growth</option>
                  <option value="multiple">Exit Multiple</option>
                </select>
              </AssumptionRow>
              {valuationMethod === 'perpetuity' ? (
                <AssumptionRow label="Terminal Growth">
                  <input
                    id="tgr-input"
                    type="number" step="0.1" min="0" max="20"
                    style={styles.inlineInput}
                    value={terminalGrowthRate}
                    onChange={(e) => { dirtyRef.current = true; setTGR(parseFloat(e.target.value) || 0) }}
                  />
                  <span style={{ fontSize: 14 }}>%</span>
                </AssumptionRow>
              ) : (
                <AssumptionRow label="Exit Multiple">
                  <input
                    id="exit-multiple-input"
                    type="number" step="0.5" min="1" max="50"
                    style={styles.inlineInput}
                    value={exitMultiple}
                    onChange={(e) => { dirtyRef.current = true; setExitMultiple(parseFloat(e.target.value) || 0) }}
                  />
                  <span style={{ fontSize: 14 }}>× EBITDA</span>
                </AssumptionRow>
              )}
              <AssumptionRow label="Forecast Period">
                <span style={{ fontWeight: 600, color: '#1E3A8A' }}>{forecastPeriod} years</span>
              </AssumptionRow>
              <AssumptionRow label="Shares Outstanding">
                <input
                  id="shares-input"
                  type="text"
                  style={{ ...styles.inlineInput, width: 100 }}
                  value={sharesOutstanding === '' ? '' : Number(sharesOutstanding).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  onChange={(e) => { 
                    dirtyRef.current = true; 
                    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
                    setShares(rawValue === '' ? '' : (parseFloat(rawValue) || 0));
                  }}
                />
                <span style={{ fontSize: 14 }} title="In thousands, matching the '000 figures">'000</span>
              </AssumptionRow>
              <AssumptionRow label="Terminal Value">
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-muted)' }}>
                  {result?.terminalValueMethod || '—'}
                </span>
              </AssumptionRow>
            </div>
          </div>

          {/* Right — Valuation Components */}
          <div className="card">
            <div className="card-header"><span className="card-title">Valuation Components</span></div>
            <div className="card-body">
              {[
                ["PV of Projected FCFs:",  fmtMoney(result?.totalPVFCF, currency)],
                ["PV of Terminal Value:",   fmtMoney(result?.pvTerminal, currency)],
              ].map(([label, val]) => (
                <div key={label} style={styles.compRow}>
                  <span className="text-muted">{label}</span>
                  <span>{val}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '12px 0' }} />
              {[
                ["Enterprise Value:",  fmtMoney(result?.enterpriseValue, currency), true],
                ["Less: Net Debt:",    fmtMoney(netDebt, currency)],
                ["Equity Value:",      fmtMoney(result?.equityValue, currency), true],
              ].map(([label, val, bold]) => (
                <div key={label} style={{ ...styles.compRow, fontWeight: bold ? 700 : 400 }}>
                  <span className={bold ? 'text-navy' : 'text-muted'} style={bold ? { color: '#1E3A8A' } : {}}>{label}</span>
                  <span>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sensitivity Analysis ─────────────────────────── */}
        <div className="card" style={{ marginTop: 20 }}>
          <div
            className="card-header"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowSensitivity(!showSensitivity)}
          >
            <span className="card-title">↗ Sensitivity Analysis</span>
            <button className="btn btn-ghost btn-sm">
              {showSensitivity ? 'Hide Analysis' : 'Show Analysis'}
            </button>
          </div>
          {showSensitivity && (
            <div className="card-body" style={{ overflowX: 'auto' }}>
              <p className="text-muted" style={{ fontSize: 12, marginBottom: 12 }}>
                {sensitivity.mode === 'multiple'
                  ? 'Value per Share across WACC (columns) × Exit Multiple (rows)'
                  : 'Value per Share across WACC (columns) × Terminal Growth Rate (rows)'}
              </p>
              {sensitivity.tgrRange.length === 0 ? (
                <div style={{ padding: '20px', color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
                  ⚠️ No valid TGR values in range — all growth rates are too close to WACC.
                  Try lowering your Terminal Growth Rate or raising WACC.
                </div>
              ) : (
              <table style={styles.sensTable}>
                <thead>
                  <tr>
                    <th style={styles.sensCell}>
                      {sensitivity.mode === 'multiple' ? 'Multiple \\ WACC' : 'TGR \\ WACC'}
                    </th>
                    {sensitivity.waccRange.map((w) => (
                      <th key={w} style={{
                        ...styles.sensCell,
                        background: w === wacc ? 'rgba(13,115,119,0.12)' : undefined,
                        color: w === wacc ? 'var(--color-teal)' : undefined,
                        fontWeight: w === wacc ? 700 : 400,
                      }}>
                        {w.toFixed(1)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivity.grid.map((row, ri) => (
                    <tr key={ri}>
                      <td style={{
                        ...styles.sensCell,
                        background: sensitivity.tgrRange[ri] === (sensitivity.mode === 'multiple' ? exitMultiple : terminalGrowthRate)
                          ? 'rgba(13,115,119,0.12)' : undefined,
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}>
                        {sensitivity.mode === 'multiple'
                          ? `${sensitivity.tgrRange[ri]?.toFixed(1)}×`
                          : `${sensitivity.tgrRange[ri]?.toFixed(2)}%`}
                      </td>
                      {row.map((val, ci) => {
                        const isBase =
                          sensitivity.waccRange[ci] === wacc &&
                          sensitivity.tgrRange[ri] === (sensitivity.mode === 'multiple' ? exitMultiple : terminalGrowthRate)
                        // Colour scale: positive = green shades, negative = red
                        const bg = isBase
                          ? 'var(--color-teal-muted)'
                          : val == null
                            ? '#f8f8f8'
                            : val < 0
                              ? `rgba(239,68,68,${Math.min(0.35, Math.abs(val) / sensitivityMax * 0.5)})`
                              : `rgba(16,185,129,${Math.min(0.35, val / sensitivityMax * 0.5)})`
                        return (
                          <td key={ci} style={{
                            ...styles.sensCell,
                            background: bg,
                            fontWeight: isBase ? 700 : 400,
                            color: val != null && val < 0 ? '#DC2626' : undefined,
                          }}>
                            {val != null ? `${Number(val).toFixed(2)} ${currency}` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
        </div>

        {/* ── Base Financial Metrics ───────────────────────── */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">Base Financial Metrics & Assumptions</span>
            {baseMetrics?.latest_year && (
              <span className="text-muted" style={{ fontSize: 12 }}>
                Derived from {baseMetrics.latest_year} financial statements
              </span>
            )}
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-center"><div className="spinner" /></div>
            ) : baseMetrics ? (
              <>
                <div style={styles.metricsGrid}>
                  {[
                    ["Base FCF",       fmtMoney(baseMetrics.base_fcf, currency)],
                    ["EBITDA",         fmtMoney(baseMetrics.ebitda, currency)],
                    ["Net Debt",       fmtMoney(baseMetrics.net_debt, currency)],
                    ["Shares ('000)",  sharesOutstanding ? Number(sharesOutstanding).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'],
                    ["Historical WACC", fmtPercent(baseMetrics.wacc?.historical_wacc)],
                  ].map(([label, val]) => (
                    <div key={label} style={styles.metricItem}>
                      <p className="text-muted" style={{ fontSize: 12 }}>{label}</p>
                      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-navy)', marginTop: 2 }}>{val}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
                  <p>
                    <strong>WACC Calculation:</strong> {baseMetrics.wacc?.calculation_note || '—'}
                  </p>
                  <p>
                    <strong>Growth Rate:</strong> Conservative estimate based on historical revenue CAGR, capped for terminal value sustainability.
                  </p>
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <p style={{ fontSize: 13 }}>Upload financial data to compute base metrics.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function KpiCard({ label, value, color, bg }) {
  return (
    <div style={{ ...styles.kpiCard, background: bg, borderColor: `${color}30` }}>
      <p style={{ fontSize: 14, color, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ fontSize: 30, fontWeight: 800, color }}>{value}</p>
    </div>
  )
}

function AssumptionRow({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
      <span className="text-muted" style={{ fontWeight: 500 }}>{label}:</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────
const styles = {
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    padding: '20px 24px',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  compRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    padding: '6px 0',
  },
  inlineInput: {
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 14,
    fontWeight: 600,
    width: 80,
    textAlign: 'right',
    color: '#1E3A8A',
    fontFamily: 'inherit',
  },
  sensTable: {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: 12,
  },
  sensCell: {
    border: '1px solid var(--color-border)',
    padding: '6px 12px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 16,
  },
  metricItem: {
    padding: '12px 16px',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-sm)',
  },
}
