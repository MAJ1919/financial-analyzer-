import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function CompaniesLanding() {
  const [projects, setProjects]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [error, setError]         = useState('')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const data = await projectsApi.list()
      setProjects(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const project = await projectsApi.create({ company_name: newName.trim() })
      navigate(`/projects/${project.id}/statements`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return
    try {
      await projectsApi.delete(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={styles.page}>
      {/* Page header */}
      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>Companies</h1>
          <p style={styles.pageSubtitle}>Select a project or create a new one to begin analysis</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user?.email && (
            <span style={styles.userEmail} title={user.email}>
              {user.email}
            </span>
          )}
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + New Project
          </button>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {/* New project form */}
      {creating && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="label">Company Name</label>
                <input
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Aramco, SABIC..."
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary">Create</button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {error && <p className="field-error" style={{ marginBottom: 16 }}>{error}</p>}

      {/* Projects grid */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No projects yet</p>
          <p style={{ fontSize: 13 }}>Click "New Project" to get started.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {projects.map((p) => (
            <div key={p.id} className="card" style={styles.projectCard}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <p style={styles.projectName}>{p.company_name}</p>
                  <p style={styles.projectMeta}>
                    {p.currency || 'SAR'} · {p.fiscal_year_end || 'Dec'} year-end
                  </p>
                  {p.updated_at && (
                    <p style={styles.projectMeta}>
                      Updated {new Date(p.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/projects/${p.id}/statements`)}
                  >
                    Open
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDelete(p.id)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    padding: '32px 40px',
    maxWidth: 1200,
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: 'var(--color-navy)',
  },
  pageSubtitle: {
    fontSize: 14,
    color: 'var(--color-text-muted)',
    marginTop: 4,
  },
  userEmail: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 20,
  },
  projectCard: {
    transition: 'box-shadow 200ms ease, transform 200ms ease',
    cursor: 'default',
  },
  projectName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--color-navy)',
    marginBottom: 4,
  },
  projectMeta: {
    fontSize: 12,
    color: 'var(--color-text-muted)',
  },
}
