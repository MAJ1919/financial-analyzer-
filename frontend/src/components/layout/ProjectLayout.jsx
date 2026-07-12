import { useEffect, useState } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { projectsApi } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'

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
  }, [projectId, setProject])

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#8b8a91' }}>Loading project...</div>
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
        <h2 style={{ color: '#ff6b6b', margin: 0 }}>Project Load Error</h2>
        <p style={{ color: '#8b8a91', margin: 0 }}>{error}</p>
        <button className="btn" onClick={() => navigate('/')}>Return to Dashboard</button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar companyName={project?.company_name} />
      <div className="main-content">
        {/* Outlet renders the child route (FinancialStatements, Analysis, etc.) */}
        <Outlet context={{ project, setProject }} />
      </div>
    </div>
  )
}
