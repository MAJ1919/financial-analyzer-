import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import Header from '../../components/layout/Header'
import ManualEntryTemplate from '../../components/ManualEntryTemplate'
import { analysisApi, uploadApi, projectsApi } from '../../services/api'
import { useProjectStore } from '../../store/projectStore'

const TABS = ['Income Statement', 'Balance Sheet', 'Cash Flow Statement']

// ============ NEW: Separate Initialization Component ============
function InitializationScreen() {
  const [setupYear, setSetupYear] = useState(new Date().getFullYear())
  const { project, initializeManualStatements } = useProjectStore()

  return (
    <>
      <Header
        title="Financial Statements"
        subtitle={project?.company_name}
        actions={
          <>
            <div style={{ display: 'inline-block', position: 'relative', marginRight: '8px' }}>
              <button className="btn btn-secondary btn-sm" disabled>
                <i className="fa-solid fa-download"></i> Download Template
              </button>
            </div>
            <button className="btn btn-primary btn-sm" disabled>
              Upload Excel
            </button>
          </>
        }
      />
      <div className="page-body">
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-navy)', fontSize: '20px', marginBottom: '12px' }}>
            Initialize Financial Statements
          </h3>
          <p style={{ color: 'var(--color-text-light)', marginBottom: '24px' }}>
            Please specify the starting year for your financial data entry.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              className="input"
              value={setupYear}
              onChange={e => setSetupYear(e.target.value)}
              style={{ width: '100px', textAlign: 'center', fontSize: '16px' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                const y = Number(setupYear)
                if (y >= 1900 && y <= 2100) {
                  initializeManualStatements(y)
                }
              }}
            >
              Create Template
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
// ============ END Initialization Component ============

export default function FinancialStatements() {
  const { projectId } = useParams()
  const { project, setProject } = useProjectStore()

  const [error, setError] = useState('')

  // Upload and Mapping state
  const fileInputRef = useRef(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)

  // ============ KEY FIX: Check if project is initialized ============
  const isInitialized = !!(
    project?.income_statement?.years?.length > 0 &&
    project?.cash_flow_statement?.years?.length > 0
  )

  // Show initialization screen ONCE at project level (not inside ManualEntryTemplate)
  if (!isInitialized) {
    return <InitializationScreen />
  }
  // ============ END KEY FIX ============

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsUploading(true)
    setError('')
    try {
      await uploadApi.uploadTemplate(projectId, file)
      const updatedProject = await projectsApi.get(projectId)
      setProject(updatedProject)
    } catch (err) {
      setError(err.message || 'Failed to upload Excel file')
    } finally {
      setIsUploading(false)
      e.target.value = null
    }
  }

  return (
    <>
      <Header
        title="Financial Statements"
        subtitle={project?.company_name}
        actions={
          <>
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div style={{ display: 'inline-block', position: 'relative', marginRight: '8px' }}>
              <a 
                href="/Saudi_Template.xlsx" 
                download 
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <i className="fa-solid fa-download"></i> Download Saudi Template
              </a>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              {isUploading ? 'Uploading...' : 'Upload Excel'}
            </button>
          </>
        }
      />
      <div className="page-body">
        {error && <p className="field-error" style={{ marginBottom: 12 }}>{error}</p>}

          <ManualEntryTemplate projectId={projectId} />
      </div>
    </>
  )
}
