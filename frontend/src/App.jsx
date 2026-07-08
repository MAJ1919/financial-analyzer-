import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import CompaniesLanding from './pages/CompaniesLanding'
import FinancialStatements from './pages/ProjectView/FinancialStatements'
import Analysis from './pages/ProjectView/Analysis'
import Forecasting from './pages/ProjectView/Forecasting'
import Valuation from './pages/ProjectView/Valuation'
import ProjectLayout from './components/layout/ProjectLayout'

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Landing — Companies list */}
          <Route path="/" element={<CompaniesLanding />} />

          {/* Project workspace — shares sidebar / header layout */}
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
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
