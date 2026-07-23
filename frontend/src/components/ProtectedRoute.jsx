import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * Gates its children behind an authenticated session.
 *
 * While the session is still being restored (`initializing`), render nothing
 * to avoid a flash-redirect that would bounce an already-logged-in user to
 * /login on a hard refresh. Once resolved: no session → redirect to /login,
 * preserving the attempted path so we can return the user there after login.
 */
export default function ProtectedRoute({ children }) {
  const session = useAuthStore((s) => s.session)
  const initializing = useAuthStore((s) => s.initializing)
  const location = useLocation()

  if (initializing) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
