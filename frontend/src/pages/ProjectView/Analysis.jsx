import { useEffect, useState, useMemo } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import Header from '../../components/layout/Header'

import { analysisApi } from '../../services/api'
import { fmtRatioValue, fmtNumber } from '../../utils/formatters'

const TABS = ['Financial Ratios', 'Horizontal Analysis']

export default function Analysis() {
  const { projectId } = useParams()
  const { project } = useOutletContext()

  const [activeTab, setActiveTab] = useState(0)
  const [ratiosData, setRatiosData]       = useState(null)
  const [horizontalData, setHorizontalData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (activeTab === 0 && !ratiosData) {
      setLoading(true)
      analysisApi.getRatios(projectId)
        .then(setRatiosData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
    if (activeTab === 1 && !horizontalData) {
      setLoading(true)
      analysisApi.getHorizontal(projectId)
        .then(setHorizontalData)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [activeTab, projectId])

  return (
    <>
      <Header title="Analysis" subtitle={project?.company_name} />
      <div className="page-body">
        <div className="tabs">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              className={`tab ${activeTab === i ? 'active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>

        {error && <p className="field-error" style={{ marginBottom: 12 }}>{error}</p>}
        {loading && <div className="loading-center"><div className="spinner" /></div>}

        {/* ── Financial Ratios Tab ── */}
        {!loading && activeTab === 0 && ratiosData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(ratiosData.ratios || {}).map(([category, ratios]) => (
              <div key={category} className="card">
                <div className="card-header">
                  <span className="card-title">{category}</span>
                </div>
                <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                  <table className="data-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40%', textAlign: 'left' }}>Ratio</th>
                        {ratiosData.years.map(year => (
                          <th key={year} style={{ width: `${60 / ratiosData.years.length}%`, textAlign: 'center' }}>{year}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(ratios).map(([ratioId, values]) => {
                        const name = values.label || ratioId
                        return (
                          <tr key={ratioId}>
                            <td style={{ fontSize: '13px' }}>{name}</td>
                            {ratiosData.years.map(year => {
                              const val = values[year]
                              return (
                                <td key={year} style={{ textAlign: 'center', fontSize: '13px' }}>
                                  {fmtRatioValue(val, values.format)}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Horizontal Analysis Tab ── */}
        {!loading && activeTab === 1 && horizontalData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(() => {
              // Compute global columns across both statements
              const colsSet = new Set()
              ;['income_statement', 'balance_sheet'].forEach(stmt => {
                const dataObj = horizontalData[stmt]
                if (dataObj) {
                  Object.values(dataObj).forEach(row => {
                    Object.keys(row).forEach(col => colsSet.add(col))
                  })
                }
              })
              const globalColumns = Array.from(colsSet).sort()

              return ['income_statement', 'balance_sheet'].map((statementKey) => {
                const dataObj = horizontalData[statementKey] || {}
                const baseStatement = project?.[statementKey] || {}
                const baseRows = baseStatement.rows || []
                const baseYears = baseStatement.years || []
                
                if (baseRows.length === 0 && Object.keys(dataObj).length === 0) return null

                // Compute total width distribution
                const numDataCols = baseYears.length + globalColumns.length
                const colWidth = 65 / Math.max(1, numDataCols)

                return (
                  <div key={statementKey} className="card">
                    <div className="card-header">
                      <span className="card-title">
                        {statementKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} - Horizontal Analysis
                      </span>
                    </div>
                    <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
                      <table className="data-table" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '35%', textAlign: 'left' }}>Line Item</th>
                            {baseYears.map((year) => (
                              <th key={year} style={{ width: `${colWidth}%`, textAlign: 'right' }}>
                                {year}
                              </th>
                            ))}
                            {globalColumns.map((col) => (
                              <th key={col} style={{ width: `${colWidth}%`, textAlign: 'center' }}>
                                {col.replace('_vs_', ' vs ').toUpperCase()}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {baseRows.map((rowMeta) => {
                            const label = rowMeta.label
                            const displayLabel = rowMeta.label_raw || label
                            const level = rowMeta.level || (rowMeta.is_subtotal ? 1 : rowMeta.is_header ? 2 : 3)

                            // Font scale matches FinancialGrid / Forecasting: 15/14/13px
                            const labelStyle = {
                              textAlign: 'left',
                              fontWeight: level <= 2 ? '700' : '500',
                              fontSize: level === 1 ? '15px' : level === 2 ? '14px' : '13px',
                              color: level <= 2 ? 'var(--color-navy)' : 'var(--color-text)',
                              background: level <= 2 ? '#f5f5f5' : undefined,
                              paddingLeft: `${(level - 1) * 16 + 8}px`,
                              borderTop: level === 1 ? '1px solid var(--color-border)' : 'none',
                              whiteSpace: 'pre',
                            }

                            const valStyle = {
                              fontWeight: level <= 2 ? '700' : '400',
                              fontSize: '13px',
                              background: level <= 2 ? '#f5f5f5' : undefined,
                              borderTop: level === 1 ? '1px solid var(--color-border)' : 'none',
                            }

                            return (
                              <tr key={label}>
                                <td style={labelStyle}>{displayLabel}</td>
                                
                                {/* Base Year Values */}
                                {baseYears.map(year => (
                                  <td key={year} style={{ ...valStyle, textAlign: 'right' }}>
                                    {fmtNumber(rowMeta.values?.[year])}
                                  </td>
                                ))}

                                {/* YoY Columns */}
                                {globalColumns.map((col) => {
                                  const yoyObj = dataObj[label] || {}
                                  const val = yoyObj[col]
                                  let formatted = '—'
                                  let color = 'inherit'
                                  if (val != null) {
                                    formatted = (val > 0 ? '+' : '') + (val * 100).toFixed(2) + '%'
                                    color = val > 0 ? 'var(--color-success)' : val < 0 ? 'var(--color-error)' : 'inherit'
                                  }
                                  return (
                                    <td key={col} style={{ ...valStyle, textAlign: 'center', color }}>
                                      {formatted}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}

        {!loading && !ratiosData && !horizontalData && (
          <div className="empty-state">
            <p style={{ fontWeight: 600 }}>No analysis available</p>
            <p style={{ fontSize: 13 }}>Upload financial data first to compute ratios and horizontal analysis.</p>
          </div>
        )}
      </div>
    </>
  )
}
