import { useState, useEffect, useCallback } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import Header from '../../components/layout/Header'
import { analysisApi } from '../../services/api'

// ── Input field configuration ──────────────────────────────────────
const INPUT_FIELDS = [
  {
    key: 'revenue_growth_rate', label: 'Revenue Growth Rate', unit: '%/yr',
    min: -20, max: 50, step: 0.1,
    help: 'Year-over-year revenue growth applied to each projected year.',
  },
]

const SCENARIO_CONFIG = {
  base:        { label: 'Base Case',   multiplier: 1.0, color: 'var(--color-teal)', bg: 'rgba(13,115,119,0.08)' },
  optimistic:  { label: 'Optimistic',  multiplier: 1.3, color: '#10B981',           bg: 'rgba(16,185,129,0.08)' },
  pessimistic: { label: 'Pessimistic', multiplier: 0.7, color: '#EF4444',           bg: 'rgba(239,68,68,0.08)'  },
}

// Dynamic rows will be fetched from project templates

// ── Helpers ────────────────────────────────────────────────────────
function fmt(n, currency = 'SAR') {
  if (n == null || !isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9)      return `${sign}${(abs / 1e9).toFixed(1)}B`
  if (abs >= 1e6)      return `${sign}${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3)      return `${sign}${(abs / 1e3).toFixed(0)}K`
  return `${sign}${abs.toFixed(0)}`
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

  // Load historically-derived assumptions on mount
  useEffect(() => {
    if (!projectId) return
    setLoadingInputs(true)
    analysisApi.getHistoricalAssumptions(projectId)
      .then(data => setInputs(data))
      .catch(() => {
        // Fallback to defaults if no data yet
        setInputs({
          revenue_growth_rate: 10.0, operating_margin_expansion: 0.5,
          capex_as_pct_of_revenue: 3.0, working_capital_change: 1.0,
          tax_rate: 25.0, depreciation_rate: 8.0, dso: 45.0,
          dio: 60.0, dpo: 30.0, interest_rate_on_debt: 4.0,
          share_repurchase_rate: 2.0, dividend_payout_ratio: 30.0,
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
        inputs,
        scenarios: [activeScenario],
        forecast_years: 5,
      })
      setResults(data)
    } catch (e) {
      console.error('Forecast failed:', e)
    } finally {
      setRunning(false)
    }
  }, [inputs, activeScenario, projectId])

  const selectScenario = (s) => setActiveScenario(s)

  // Derived display data
  const primaryScenario = results?.scenarios?.[activeScenario] || results?.scenarios?.base
  const forecasts = primaryScenario?.forecasts || []
  const cumulative = primaryScenario?.cumulative_metrics || null
  const years = forecasts.map(f => f.year)
  const activeRows = project?.[activeTab]?.rows || []

  const isInitialized = !!(
    project?.income_statement?.years?.length > 0 &&
    project?.balance_sheet?.years?.length > 0
  )

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
                  INPUT_FIELDS.map(({ key, label, unit, min, max, step, help }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {label}
                        </label>
                        <span style={{ fontSize: 11, color: 'var(--color-teal)', fontWeight: 700 }}>
                          {inputs[key]} {unit}
                          {activeScenario !== 'base' && (
                            <span style={{ color: SCENARIO_CONFIG[activeScenario].color, marginLeft: 4 }}>
                              (Effective: {(inputs[key] * SCENARIO_CONFIG[activeScenario].multiplier).toFixed(1)} {unit})
                            </span>
                          )}
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
                  ))
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
                        {activeRows.map(row => (
                          <tr key={row.key} style={{ 
                            background: row.is_subtotal ? 'var(--color-bg)' : undefined,
                            borderTop: row.is_header ? '1px solid var(--color-border)' : 'none'
                          }}>
                            <td style={{
                              ...styles.td,
                              textAlign: 'left', // Fix Left-to-Right layout issue
                              paddingLeft: row.level === 3 ? 24 : 12,
                              fontWeight: (row.level === 1 || row.level === 2 || row.is_subtotal) ? 700 : 400,
                              color: row.is_header ? 'var(--color-navy)' : undefined,
                            }}>
                              {row.label}
                            </td>
                            {forecasts.map(f => {
                              const source = f[`full_${activeTab}`] || {};
                              const val = source[row.key];
                              
                              let txtColor = undefined;
                              if (row.key === 'balanceCheck') {
                                  if (val > 0.5) txtColor = '#10B981';
                                  else if (val < -0.5) txtColor = '#3B82F6';
                                  else txtColor = 'var(--color-text)';
                              } else if (val < 0) {
                                  txtColor = 'var(--color-danger, #EF4444)';
                              }

                              return (
                                <td key={f.year} style={{
                                  ...styles.td,
                                  fontWeight: (row.level === 1 || row.level === 2 || row.is_subtotal) ? 700 : 400,
                                  color: txtColor,
                                }}>
                                  {row.is_header ? '' : fmt(val, currency)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
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
    padding: '10px 14px',
    background: 'var(--color-bg)',
    fontWeight: 700,
    fontSize: 12,
    borderBottom: '2px solid var(--color-border)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 14px',
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
}
