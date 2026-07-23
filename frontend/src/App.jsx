import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import CompaniesLanding from './pages/CompaniesLanding'
import FinancialStatements from './pages/ProjectView/FinancialStatements'
import Analysis from './pages/ProjectView/Analysis'
import Forecasting from './pages/ProjectView/Forecasting'
import Valuation from './pages/ProjectView/Valuation'
import ProjectLayout from './components/layout/ProjectLayout'

function App() {
  const initialize = useAuthStore((s) => s.initialize)

  // Hydrate the auth session once, at startup, before routes evaluate.
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Landing — Companies list (protected) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CompaniesLanding />
              </ProtectedRoute>
            }
          />

          {/* Project workspace — shares sidebar / header layout (protected) */}
          <Route
            path="/projects/:projectId"
            element={
              <ProtectedRoute>
                <ProjectLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="statements" replace />} />
            <Route path="statements" element={<FinancialStatements />} />
            <Route path="analysis"   element={<Analysis />} />
            <Route path="forecast"   element={<Forecasting />} />
            <Route path="valuation"  element={<Valuation />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
