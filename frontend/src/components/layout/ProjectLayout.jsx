import { useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { projectsApi } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'
import { SkeletonLine, SkeletonTable } from '../Skeleton'

/**
 * Project workspace layout shell.
 * Wraps all project-level pages (Statements, Analysis, Forecasting, Valuation).
 * Fetches the project to provide the company name to the sidebar.
 */
export default function ProjectLayout() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { project, setProject } = useProjectStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Bumped by the error-state Retry button to re-run the fetch effect.
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    projectsApi.get(projectId)
      .then(data => {
        if (isMounted) {
          setProject(data)
          setLoading(false)
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error(err)
          setError(err.message || 'Failed to load project')
          setLoading(false)
        }
      })
      
    return () => { isMounted = false }
  }, [projectId, setProject, retryCount])

  // Keep the shell mounted while loading: the sidebar stays put and only the
  // content region swaps to skeletons. Previously this returned a bare
  // full-screen string, so the entire app flashed away on every project open.
  if (loading) {
    return (
      <div className="app-shell">
        <Sidebar companyName={project?.company_name} />
        <div className="main-content">
          <div className="page-body">
            <div style={{ maxWidth: 320, marginBottom: 24 }}>
              <SkeletonLine w="60%" h={20} />
              <SkeletonLine w="40%" />
            </div>
            <div className="card">
              <div className="card-body">
                <SkeletonTable rows={8} label="Loading project" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          alignItems: 'center', height: '100vh', gap: 12, padding: 24, textAlign: 'center',
        }}
      >
        <h2 style={{ color: 'var(--color-error)', margin: 0, fontSize: 18 }}>
          Project Load Error
        </h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, maxWidth: 420 }}>{error}</p>
        {/* An error state needs a way forward, not just a way out. */}
        <div className="flex gap-2" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" onClick={() => setRetryCount((n) => n + 1)}>
            Try again
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar companyName={project?.company_name} />
      <div className="main-content">
        {/* Child routes read the project from useProjectStore — the single
            state authority. No Outlet context: two subscription models for
            the same object caused stale-render bugs. */}
        <Outlet />
      </div>
    </div>
  )
}
