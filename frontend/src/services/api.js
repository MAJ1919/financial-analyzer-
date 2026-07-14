/**
 * API service — all calls to the FastAPI backend.
 * Base URL defaults to Vite proxy target or explicit env var.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  // NOTE: Do NOT set a default Content-Type header here.
  // Axios v1.x auto-detects: JSON for objects, multipart for FormData.
})

// ── Response interceptor — surface errors clearly ─────────────────
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error'
    return Promise.reject(new Error(message))
  }
)

// ── Project Management ────────────────────────────────────────────
export const projectsApi = {
  list: ()                    => api.get('/projects/'),
  get:  (id)                  => api.get(`/projects/${id}`),
  create: (payload)           => api.post('/projects/', payload),
  update: (id, payload)       => api.patch(`/projects/${id}`, payload),
  delete: (id)                => api.delete(`/projects/${id}`),
}

// ── Upload / Data Ingestion ───────────────────────────────────────
export const uploadApi = {
  uploadTemplate: (projectId, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/upload/template/${projectId}`, form, {
      timeout: 60000,
    })
  },
  saveManual: (projectId, payload) =>
    api.post(`/upload/manual/${projectId}`, payload),
}

// ── Templates ─────────────────────────────────────────────────────
export const templatesApi = {
  // Canonical statement structure — single source of truth on the backend
  getStatementTemplates: () => api.get('/templates/statements'),
}

// ── Analysis Engine ───────────────────────────────────────────────
export const analysisApi = {
  getRatios:              (projectId) => api.get(`/analysis/${projectId}/ratios`),
  getHorizontal:          (projectId) => api.get(`/analysis/${projectId}/horizontal`),
  getForecast:            (projectId) => api.get(`/analysis/${projectId}/forecast`),
  getHistoricalAssumptions: (projectId) => api.get(`/analysis/${projectId}/forecast/assumptions`),
  computeForecast:        (projectId, payload) => api.post(`/analysis/${projectId}/forecast/compute`, payload),
  getDcfMetrics:          (projectId) => api.get(`/analysis/${projectId}/dcf-metrics`),
}

// ── Export ────────────────────────────────────────────────────────
export const exportApi = {
  // Fetch the .xlsx as a Blob (interceptor returns response.data = Blob).
  downloadExcel: (projectId) =>
    api.get(`/projects/${projectId}/export/excel`, {
      responseType: 'blob',
      timeout: 120000,
    }),
}

/**
 * Trigger a browser download of the project's Excel model.
 * Throws with a readable message if the backend rejects (e.g. no data).
 */
export async function downloadProjectExcel(projectId, companyName = 'Project') {
  let blob
  try {
    blob = await exportApi.downloadExcel(projectId)
  } catch (err) {
    // Blob error bodies arrive as a Blob — try to read the JSON detail.
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const parsed = JSON.parse(text)
        throw new Error(parsed.detail || 'Export failed')
      } catch (inner) {
        throw new Error(inner.message || 'Export failed')
      }
    }
    throw err
  }
  const safe = (companyName || 'Project').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'Project'
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}_Financial_Model.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default api
