import { useEffect, useState } from 'react'
import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { downloadProjectExcel } from '../../services/api'
import { useAuthStore } from '../../store/authStore'

const NAV_ITEMS = [
  { to: 'statements', label: 'Financial Statements', icon: '📄' },
  { to: 'analysis',   label: 'Analysis',             icon: '📊' },
  { to: 'forecast',   label: 'Forecasting',          icon: '📈' },
  { to: 'valuation',  label: 'Valuation (DCF)',       icon: '💰' },
]

const COLLAPSE_KEY = 'finanalyzer.sidebarCollapsed'

export default function Sidebar({ companyName }) {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const signOut = useAuthStore((s) => s.signOut)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )

  // Drive the CSS variable both the <aside> and .main-content read, so the
  // content margin follows the sidebar without a second source of truth.
  useEffect(() => {
    const root = document.documentElement
    const collapsedWidth = getComputedStyle(root)
      .getPropertyValue('--sidebar-width-collapsed').trim() || '68px'
    if (collapsed) root.style.setProperty('--sidebar-width', collapsedWidth)
    else root.style.removeProperty('--sidebar-width')
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    // Restore the expanded width when the sidebar unmounts (e.g. the
    // Companies landing page), otherwise a collapsed width would leak into
    // any other layout that reads the same variable.
    return () => root.style.removeProperty('--sidebar-width')
  }, [collapsed])

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

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
      <div style={{ ...styles.brand, ...(collapsed ? styles.brandCollapsed : {}) }}>
        <span style={styles.brandIcon}>FA</span>
        {!collapsed && <span style={styles.brandLabel}>FinAnalyzer</span>}
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={styles.collapseBtn}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Project context */}
      {companyName && !collapsed && (
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
            title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(collapsed ? styles.navItemCollapsed : {}),
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span>{icon}</span>
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Export + back to companies */}
      <div style={{ ...styles.footer, ...(collapsed ? styles.footerCollapsed : {}) }}>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          style={{
            ...styles.exportBtn,
            ...(collapsed ? styles.exportBtnCollapsed : {}),
            ...(exporting ? styles.exportBtnDisabled : {}),
          }}
          title="Download the full financial model as a formatted Excel workbook"
        >
          <span>⬇</span>
          {!collapsed && <span>{exporting ? 'Preparing…' : 'Export to Excel'}</span>}
        </button>
        {exportError && !collapsed && <p style={styles.exportError}>{exportError}</p>}
        <NavLink
          to="/"
          style={{ ...styles.backLink, ...(collapsed ? styles.backLinkCollapsed : {}) }}
          title={collapsed ? 'All Companies' : undefined}
        >
          {collapsed ? '←' : '← All Companies'}
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          style={{ ...styles.logoutBtn, ...(collapsed ? styles.logoutBtnCollapsed : {}) }}
          title={collapsed ? 'Log out' : undefined}
        >
          {collapsed ? '⏻' : 'Log out'}
        </button>
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
    transition: 'width var(--transition-med)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  brandCollapsed: {
    justifyContent: 'center',
    padding: '20px 0',
  },
  collapseBtn: {
    position: 'absolute',
    top: 24,
    right: -11,
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'var(--color-navy)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 101,
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
    transition: 'background 150ms ease, color 150ms ease, border-left-color 150ms ease',
    // Longhand only. Mixing `borderLeft` here with `borderLeftColor` in the
    // active style made React warn on every rerender and drop the override.
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    gap: 0,
    padding: '10px 0',
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
  footerCollapsed: {
    padding: '16px 0',
    alignItems: 'center',
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
  exportBtnCollapsed: {
    width: 40,
    padding: '10px 0',
    gap: 0,
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
  backLinkCollapsed: {
    fontSize: 14,
    textAlign: 'center',
  },
  logoutBtnCollapsed: {
    width: 40,
    padding: '8px 0',
    fontSize: 14,
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'center',
  },
}
