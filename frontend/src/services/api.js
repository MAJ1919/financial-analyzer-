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

// ── Analysis Engine ───────────────────────────────────────────────
export const analysisApi = {
  getRatios:              (projectId) => api.get(`/analysis/${projectId}/ratios`),
  getHorizontal:          (projectId) => api.get(`/analysis/${projectId}/horizontal`),
  getCashFlow:            (projectId) => api.get(`/analysis/${projectId}/cashflow`),
  getForecast:            (projectId) => api.get(`/analysis/${projectId}/forecast`),
  getHistoricalAssumptions: (projectId) => api.get(`/analysis/${projectId}/forecast/assumptions`),
  computeForecast:        (projectId, payload) => api.post(`/analysis/${projectId}/forecast/compute`, payload),
  saveForecast:           (projectId, payload) => api.patch(`/analysis/${projectId}/forecast`, payload),
  getDcfMetrics:          (projectId) => api.get(`/analysis/${projectId}/dcf-metrics`),
}

export default api
