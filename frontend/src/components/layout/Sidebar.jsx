import { useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { downloadProjectExcel } from '../../services/api'

const NAV_ITEMS = [
  { to: 'statements', label: 'Financial Statements', icon: '📄' },
  { to: 'analysis',   label: 'Analysis',             icon: '📊' },
  { to: 'forecast',   label: 'Forecasting',          icon: '📈' },
  { to: 'valuation',  label: 'Valuation (DCF)',       icon: '💰' },
]

export default function Sidebar({ companyName }) {
  const { projectId } = useParams()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const handleExport = async () => {
    setExportError('')
    setExporting(true)
    try {
      await downloadProjectExcel(projectId, companyName)
    } catch (err) {
      setExportError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <aside style={styles.sidebar}>
      {/* Brand */}
      <div style={styles.brand}>
        <span style={styles.brandIcon}>FA</span>
        <span style={styles.brandLabel}>FinAnalyzer</span>
      </div>

      {/* Project context */}
      {companyName && (
        <div style={styles.projectCtx}>
          <p style={styles.projectLabel}>Current Project</p>
          <p style={styles.projectName}>{companyName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav style={styles.nav}>
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={`/projects/${projectId}/${to}`}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Export + back to companies */}
      <div style={styles.footer}>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{ ...styles.exportBtn, ...(exporting ? styles.exportBtnDisabled : {}) }}
          title="Download the full financial model as a formatted Excel workbook"
        >
          <span>⬇</span>
          <span>{exporting ? 'Preparing…' : 'Export to Excel'}</span>
        </button>
        {exportError && <p style={styles.exportError}>{exportError}</p>}
        <NavLink to="/" style={styles.backLink}>
          ← All Companies
        </NavLink>
      </div>
    </aside>
  )
}

const styles = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: 'var(--sidebar-width)',
    background: 'var(--color-navy)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    borderRight: '1px solid rgba(255,255,255,0.08)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  brandIcon: {
    background: 'var(--color-teal)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    width: 32,
    height: 32,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  brandLabel: {
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '-0.02em',
  },
  projectCtx: {
    padding: '14px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  projectLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  nav: {
    flex: 1,
    padding: '12px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    borderRadius: 0,
    transition: 'background 150ms ease, color 150ms ease',
    borderLeft: '3px solid transparent',
  },
  navItemActive: {
    background: 'rgba(13,115,119,0.25)',
    color: '#fff',
    borderLeftColor: 'var(--color-teal)',
  },
  footer: {
    padding: '16px 18px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  exportBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '10px 12px',
    background: 'var(--color-teal)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 150ms ease',
  },
  exportBtnDisabled: {
    opacity: 0.6,
    cursor: 'default',
  },
  exportError: {
    fontSize: 11,
    color: '#ffb4b4',
    margin: 0,
  },
  backLink: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
  },
}
