import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { analysisApi } from '../../services/api'
import { recalculateTotals } from '../../utils/calculations'

// ── Core assumptions (user-facing form) ────────────────────────
// Revenue growth is rendered separately (single-rate vs per-year modes).
const ASSUMPTION_FIELDS = [
  {
    key: 'tax_rate', label: 'Effective Tax Rate', unit: '%',
    min: 0, max: 60, step: 0.5,
    help: 'Effective income tax rate applied to pre-tax income.',
  },
  {
    key: 'capex_as_pct_of_revenue', label: 'CapEx % of Revenue', unit: '%',
    min: 0, max: 30, step: 0.1,
    help: 'Capital expenditures as a % of revenue.',
  },
  {
    key: 'dividend_payout_ratio', label: 'Dividend Payout Ratio', unit: '%',
    min: 0, max: 100, step: 1,
    help: '% of net income paid out as dividends.',
  },
  {
    key: 'interest_rate_on_debt', label: 'Interest Rate on Debt', unit: '%',
    min: 0, max: 20, step: 0.1,
    help: 'Annual interest rate applied to the debt balance.',
  },
]

// ── Advanced operating ratios (auto-derived from historicals, overridable) ──
const RATIO_FIELDS = [
  {
    key: 'dso', label: 'Days Sales Outstanding (DSO)', unit: 'days',
    min: 0, max: 180, step: 1,
    help: 'Average days to collect receivables.',
  },
  {
    key: 'dio', label: 'Days Inventory Outstanding (DIO)', unit: 'days',
    min: 0, max: 365, step: 1,
    help: 'Average days to turn over inventory.',
  },
  {
    key: 'dpo', label: 'Days Payable Outstanding (DPO)', unit: 'days',
    min: 0, max: 180, step: 1,
    help: 'Average days to pay suppliers.',
  },
  {
    key: 'depreciation_rate', label: 'Depreciation Rate', unit: '%',
    min: 0, max: 30, step: 0.1,
    help: 'Depreciation as a % of revenue.',
  },
]

const FORECAST_YEARS = 5

// ── Balance mode: how the projected balance sheet is closed ─────
const BALANCE_MODES = {
  balanced: {
    label: 'Balanced (cash plug)',
    help: 'Cash/revolver is solved so Assets = Liabilities + Equity every year, regardless of input data quality.',
  },
  faithful: {
    label: 'Faithful (carry imbalance)',
    help: 'Cash is driven by the cash flow statement. If your historical balance sheet is imbalanced, the forecast stays imbalanced by the same amount.',
  },
}

const SCENARIO_CONFIG = {
  base:        { label: 'Base Case',   multiplier: 1.0, color: 'var(--color-teal)', bg: 'rgba(13,115,119,0.08)' },
  optimistic:  { label: 'Optimistic',  multiplier: 1.3, color: '#10B981',           bg: 'rgba(16,185,129,0.08)' },
  pessimistic: { label: 'Pessimistic', multiplier: 0.7, color: '#EF4444',           bg: 'rgba(239,68,68,0.08)'  },
}

// Dynamic rows will be fetched from project templates

// ── Helpers ──────────────────────────────────────────────────────
function fmt(n) {
  if (n == null || !isFinite(n)) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtPct(n) { return n == null ? '—' : `${Number(n).toFixed(1)}%` }

export default function Forecasting() {
  const { projectId } = useParams()
  const { project }   = useOutletContext()
  const currency      = project?.currency || 'SAR'

  // ── State ──────────────────────────────────────────────────
  const [inputs, setInputs]             = useState(null)  // ForecastInputs
  const [results, setResults]           = useState(null)  // run_forecast response
  const [loadingInputs, setLoadingInputs] = useState(true)
  const [running, setRunning]           = useState(false)
  const [activeScenario, setActiveScenario] = useState('base')
  const [activeTab, setActiveTab]       = useState('income_statement')  // income_statement | balance_sheet | cash_flow
  const [balanceMode, setBalanceMode]   = useState('balanced')          // 'balanced' | 'faithful'
  const [growthMode, setGrowthMode]     = useState('single')            // 'single' | 'per_year'
  const [perYearRates, setPerYearRates] = useState(Array(FORECAST_YEARS).fill(10))
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Load historically-derived assumptions on mount
  useEffect(() => {
    if (!projectId) return
    setLoadingInputs(true)
    analysisApi.getHistoricalAssumptions(projectId)
      .then(data => {
        setInputs(data)
        // Seed the per-year grid from the derived single rate
        if (data?.revenue_growth_rate != null) {
          setPerYearRates(Array(FORECAST_YEARS).fill(data.revenue_growth_rate))
        }
      })
      .catch(() => {
        // Fallback to defaults if no data yet
        setInputs({
          revenue_growth_rate: 10.0, tax_rate: 25.0,
          capex_as_pct_of_revenue: 3.0, dividend_payout_ratio: 30.0,
          interest_rate_on_debt: 4.0, dso: 45.0, dio: 60.0, dpo: 30.0,
          depreciation_rate: 8.0,
        })
      })
      .finally(() => setLoadingInputs(false))

    // Load previously saved forecast if available
    analysisApi.getForecast(projectId)
      .then(data => { if (data?.scenarios) setResults(data) })
      .catch(() => {})
  }, [projectId])

  const runForecast = useCallback(async () => {
    if (!inputs) return
    setRunning(true)
    try {
      const data = await analysisApi.computeForecast(projectId, {
        inputs: {
          ...inputs,
          // Per-year mode sends the rate grid; single mode sends null so the
          // backend falls back to the flat revenue_growth_rate.
          revenue_growth_rates: growthMode === 'per_year' ? perYearRates : null,
        },
        scenarios: [activeScenario],
        forecast_years: FORECAST_YEARS,
        balance_mode: balanceMode,
      })
      setResults(data)
    } catch (e) {
      console.error('Forecast failed:', e)
    } finally {
      setRunning(false)
    }
  }, [inputs, activeScenario, projectId, balanceMode, growthMode, perYearRates])

  const selectScenario = (s) => setActiveScenario(s)

  // Derived display data
  const primaryScenario = results?.scenarios?.[activeScenario] || results?.scenarios?.base
  const forecasts = primaryScenario?.forecasts || []
  const cumulative = primaryScenario?.cumulative_metrics || null
  const years = forecasts.map(f => f.year)
  const activeRows = project?.[activeTab === 'cash_flow_statement' ? 'cash_flow_statement' : activeTab]?.rows || []

  const isInitialized = !!(
    project?.income_statement?.rows?.length > 0 &&
    project?.balance_sheet?.rows?.length > 0
  )

  // Build projected rows: merge backend proportional values into the row structure,
  // then re-run recalculateTotals so every header/subtotal is summed from its
  // children — exactly matching the hierarchy on the Financial Statements page.
  const projectedRows = useMemo(() => {
    if (!forecasts.length || !activeRows.length) return activeRows
    const statType = activeTab // 'income_statement' | 'balance_sheet' | 'cash_flow_statement'

    // Seed each row with the backend-supplied proportional value per forecast year
    const seeded = activeRows.map(row => ({
      ...row,
      values: Object.fromEntries(
        forecasts.map(f => {
          const source = f[`full_${statType}`] || {}
          const v = source[row.key]
          // Use backend value if present and the row is a leaf (not header/subtotal)
          // Headers will be recomputed by recalculateTotals below
          return [String(f.year), v != null ? Number(v) : 0]
        })
      ),
    }))

    // Re-run the same calculation engine used by the Financial Statements page
    try {
      return recalculateTotals(statType, seeded)
    } catch {
      return seeded
    }
  }, [forecasts, activeRows, activeTab])

  if (!isInitialized) {
    return (
      <>
        <Header title="5-Year Forecasting" subtitle={project?.company_name} />
        <div className="page-body">
          <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
            <h3 style={{ color: 'var(--color-navy)', fontSize: '20px', marginBottom: '12px' }}>
              No Financial Data Available
            </h3>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
              We need some historical financial data to run a forecast. Please go to the <strong>Financial Statements</strong> section to either upload an Excel file or manually enter your data first.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="5-Year Forecasting"
        subtitle={project?.company_name}
        actions={
          <button
            className="btn btn-primary"
            onClick={runForecast}
            disabled={running || loadingInputs || !inputs}
          >
            {running ? '⏳ Running...' : '▶ Run Forecast'}
          </button>
        }
      />
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

          {/* ── Inputs Panel ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Scenario toggles */}
            <div className="card">
              <div className="card-header"><span className="card-title">Scenarios</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(SCENARIO_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => selectScenario(key)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1.5px solid ${activeScenario === key ? cfg.color : 'var(--color-border)'}`,
                      background: activeScenario === key ? cfg.bg : 'transparent',
                      color: activeScenario === key ? cfg.color : 'var(--color-text-muted)',
                      fontWeight: activeScenario === key ? 700 : 400,
                      fontSize: 13, cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {activeScenario === key ? '✓ ' : ''}{cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Balance mode toggle */}
            <div className="card">
              <div className="card-header"><span className="card-title">Balance Sheet Mode</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(BALANCE_MODES).map(([key, cfg]) => (
                  <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="balance_mode"
                      checked={balanceMode === key}
                      onChange={() => setBalanceMode(key)}
                      style={{ marginTop: 2, accentColor: 'var(--color-teal)' }}
                    />
                    <span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: balanceMode === key ? 'var(--color-teal)' : 'var(--color-text)' }}>
                        {cfg.label}
                      </span>
                      <span style={{ display: 'block', fontSize: 10.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                        {cfg.help}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Assumptions inputs */}
            <div className="card" style={{ flex: 1 }}>
              <div className="card-header">
                <span className="card-title">Assumptions</span>
                <span className="badge badge-info">Auto-derived</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {loadingInputs ? (
                  <div className="loading-center"><div className="spinner" /></div>
                ) : inputs ? (
                  <>
                    {/* ── Revenue Growth ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
                        Revenue Growth
                      </span>
                      {/* single-rate vs per-year toggle */}
                      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                        {[['single', 'Single'], ['per_year', 'Per-Year']].map(([mode, lbl]) => (
                          <button
                            key={mode}
                            onClick={() => setGrowthMode(mode)}
                            style={{
                              padding: '3px 8px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: growthMode === mode ? 'var(--color-teal)' : 'transparent',
                              color: growthMode === mode ? '#fff' : 'var(--color-text-muted)',
                            }}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {growthMode === 'single' ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            Growth Rate
                          </label>
                          <span style={{ fontSize: 11, color: 'var(--color-teal)', fontWeight: 700 }}>
                            {inputs.revenue_growth_rate} %/yr
                            {activeScenario !== 'base' && (
                              <span style={{ color: SCENARIO_CONFIG[activeScenario].color, marginLeft: 4 }}>
                                ({(inputs.revenue_growth_rate * SCENARIO_CONFIG[activeScenario].multiplier).toFixed(1)} %/yr)
                              </span>
                            )}
                          </span>
                        </div>
                        <input
                          type="range" min={-20} max={50} step={0.1}
                          value={inputs.revenue_growth_rate ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, revenue_growth_rate: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--color-teal)' }}
                        />
                        <input
                          type="number" min={-20} max={50} step={0.1}
                          value={inputs.revenue_growth_rate ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, revenue_growth_rate: parseFloat(e.target.value) || 0 }))}
                          style={styles.numInput}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {perYearRates.map((rate, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', width: 68, flexShrink: 0 }}>
                              Year {i + 1}
                            </label>
                            <input
                              type="number" min={-50} max={100} step={0.1}
                              value={rate}
                              onChange={e => {
                                const v = parseFloat(e.target.value) || 0
                                setPerYearRates(prev => prev.map((r, j) => (j === i ? v : r)))
                              }}
                              style={{ ...styles.numInput, marginTop: 0 }}
                            />
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>%</span>
                          </div>
                        ))}
                        {activeScenario !== 'base' && (
                          <span style={{ fontSize: 10, color: SCENARIO_CONFIG[activeScenario].color }}>
                            × {SCENARIO_CONFIG[activeScenario].multiplier} scenario multiplier applied to each year
                          </span>
                        )}
                      </div>
                    )}

                    {/* ── Core Assumptions ── */}
                    <div style={{
                      borderTop: '1px solid var(--color-border)', margin: '6px 0 4px', paddingTop: 8,
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.08em', color: 'var(--color-text-muted)'
                    }}>
                      Core Assumptions
                    </div>
                    {ASSUMPTION_FIELDS.map(({ key, label, unit, min, max, step }) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            {label}
                          </label>
                          <span style={{ fontSize: 11, color: 'var(--color-teal)', fontWeight: 700 }}>
                            {inputs[key]} {unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min} max={max} step={step}
                          value={inputs[key] ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--color-teal)' }}
                        />
                        <input
                          type="number"
                          min={min} max={max} step={step}
                          value={inputs[key] ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          style={styles.numInput}
                        />
                      </div>
                    ))}

                    {/* ── Advanced: auto-derived operating ratios ── */}
                    <button
                      onClick={() => setShowAdvanced(v => !v)}
                      style={{
                        borderTop: '1px solid var(--color-border)', marginTop: 6, paddingTop: 8,
                        border: 'none', borderRadius: 0, background: 'none', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'var(--color-text-muted)', width: '100%',
                      }}
                    >
                      <span>Advanced — Derived Ratios</span>
                      <span>{showAdvanced ? '▾' : '▸'}</span>
                    </button>
                    {showAdvanced && RATIO_FIELDS.map(({ key, label, unit, min, max, step }) => (
                      <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                            {label}
                          </label>
                          <span style={{ fontSize: 11, color: 'var(--color-navy)', fontWeight: 700 }}>
                            {inputs[key]} {unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min} max={max} step={step}
                          value={inputs[key] ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                          style={{ width: '100%', accentColor: 'var(--color-navy)' }}
                        />
                        <input
                          type="number"
                          min={min} max={max} step={step}
                          value={inputs[key] ?? 0}
                          onChange={e => setInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          style={styles.numInput}
                        />
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* ── Output Panel ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {!results ? (
              <div className="card">
                <div className="card-body">
                  <div className="empty-state" style={{ padding: '60px 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                    <p style={{ fontWeight: 600, marginBottom: 6 }}>No forecast yet</p>
                    <p className="text-muted" style={{ fontSize: 13 }}>
                      Adjust assumptions and click <strong>Run Forecast</strong> to generate 5-year projections.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Base-year reconciliation warning */}
                {Math.abs(results?.base_imbalance ?? 0) > 0.5 && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid #F59E0B', background: 'rgba(245,158,11,0.08)',
                    fontSize: 12.5, color: '#92400E', lineHeight: 1.5,
                  }}>
                    ⚠ <strong>Base-year balance sheet does not reconcile:</strong>{' '}
                    Assets − (Liabilities + Equity) = {fmt(results.base_imbalance)}.{' '}
                    {results.balance_mode === 'faithful'
                      ? 'Faithful mode carries this imbalance through every forecast year (see Balance Check row).'
                      : 'Balanced mode absorbs this into the cash/revolver plug — the forecast will balance, but the source data should be corrected.'}
                  </div>
                )}

                {/* Cumulative KPIs */}
                {cumulative && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Revenue CAGR', value: fmtPct(cumulative.revenue_cagr) },
                      { label: 'Total FCF', value: fmt(cumulative.total_free_cash_flow, currency) },
                      { label: 'Avg. Operating Margin', value: fmtPct(cumulative.avg_operating_margin) },
                      { label: 'Avg. Net Margin', value: fmtPct(cumulative.avg_net_margin) },
                    ].map(({ label, value }) => (
                      <div key={label} className="card" style={{ padding: 0 }}>
                        <div className="card-body">
                          <p className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>{label}</p>
                          <p style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-navy)' }}>{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab navigation */}
                <div className="card">
                  <div className="card-header" style={{ gap: 0, padding: 0 }}>
                    {[
                      { key: 'income_statement', label: 'Income Statement' },
                      { key: 'balance_sheet',    label: 'Balance Sheet' },
                      { key: 'cash_flow_statement', label: 'Cash Flow Statement' },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                          padding: '12px 18px',
                          border: 'none',
                          borderBottom: activeTab === tab.key
                            ? '2px solid var(--color-teal)'
                            : '2px solid transparent',
                          background: 'none',
                          fontWeight: activeTab === tab.key ? 700 : 400,
                          color: activeTab === tab.key ? 'var(--color-teal)' : 'var(--color-text-muted)',
                          cursor: 'pointer', fontSize: 13,
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                    {/* Projected Statements Table */}
                  <div className="card-body" style={{ overflowX: 'auto', padding: 0 }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, width: 200, textAlign: 'left' }}>Line Item</th>
                          {years.map(y => <th key={y} style={styles.th}>{y}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {projectedRows.map(row => {
                          let level = row.level || (row.is_subtotal ? 1 : row.is_header ? 2 : 3);
                          if (row.is_subtotal) level = 1;
                          else if (row.is_header && level > 2) level = 2;
                          
                          const bg = (row.is_header || row.is_subtotal) ? '#f5f5f5' : undefined;
                          const fw = level === 1 ? 700 : level === 2 ? 600 : 400;
                          const fs = level === 1 ? '15px' : level === 2 ? '14px' : '13px';
                          
                          // Hide non-calculable 'pure label' headers
                          let hideValue = false;
                          if (row.is_header && !row.is_subtotal) {
                              if (['earningsPerShareHeader', 'sharesOutstandingHeader', 'supplementalMetricsHeader', 'comprehensiveIncomeHeader', 'receivablesChangeHeader', 'inventoryChangeHeader', 'otherCurrentAssetsChangeHeader', 'payablesChangeHeader', 'otherLiabilitiesChangeHeader', 'otherOperatingActivitiesHeader', 'borrowingsHeader', 'debtRepaymentsHeader', 'shareholderReturnsHeader', 'otherFinancingActivitiesHeader', 'cashReconciliationHeader', 'supplementalDisclosureHeader'].includes(row.key)) {
                                  hideValue = true;
                              }
                          }
                          
                          return (
                            <tr key={row.key} style={{ 
                              background: bg,
                              borderTop: level === 1 ? '1px solid var(--color-border)' : 'none'
                            }}>
                              <td style={{
                                ...styles.td,
                                textAlign: 'left',
                                paddingLeft: `${(level - 1) * 20 + 8}px`,
                                fontWeight: fw,
                                fontSize: fs,
                                color: level <= 2 ? 'var(--color-navy)' : 'var(--color-text)',
                                whiteSpace: 'pre',
                              }}>
                                {row.label}
                              </td>
                              {years.map(yr => {
                                const val = row.values?.[String(yr)]
                                
                                let txtColor = undefined;
                                if (row.key === 'balanceCheck') {
                                    if (val > 0.5)  txtColor = '#10B981'; // Green — assets surplus
                                    else if (val < -0.5) txtColor = '#DC2626'; // Red — E+L surplus
                                    else txtColor = '#10B981'; // Green — exactly balanced
                                } else if (val < 0) {
                                    txtColor = 'var(--color-error, #EF4444)';
                                }
  
                                return (
                                  <td key={yr} style={{
                                    ...styles.td,
                                    fontWeight: fw,
                                    fontSize: fs,
                                    color: txtColor,
                                  }}>
                                    {hideValue ? '' : fmt(val)}
                                  </td>
                                )
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = {
  numInput: {
    width: '100%',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    padding: '3px 6px',
    fontSize: 12,
    marginTop: 2,
    color: 'var(--color-navy)',
    fontFamily: 'inherit',
    background: 'var(--color-surface)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    padding: '12px 16px',
    background: 'var(--color-bg)',
    textAlign: 'right',
    borderBottom: '2px solid var(--color-border)',
    color: 'var(--color-text-muted)',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
}
