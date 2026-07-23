import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

/**
 * Landing page for the password-reset email link.
 *
 * Supabase's client (detectSessionInUrl: true) auto-exchanges the recovery
 * token in the URL for a temporary session and emits a PASSWORD_RECOVERY auth
 * event. We just need to collect a new password and call updateUser().
 */
export default function ResetPassword() {
  const [ready, setReady] = useState(false) // recovery session established?
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // The recovery link may establish the session slightly after mount; listen
    // for it, and also check for an already-present session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Could not update password. Try the link again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.brand}>
        <span style={styles.brandIcon}>FA</span>
        <span style={styles.brandLabel}>FinAnalyzer</span>
      </div>

      <div className="card" style={styles.card}>
        <div className="card-body">
          <h1 style={styles.title}>Set a new password</h1>

          {done ? (
            <>
              <p style={styles.notice} role="status">
                Your password has been updated.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                onClick={() => navigate('/login', { replace: true })}
              >
                Go to sign in
              </button>
            </>
          ) : !ready ? (
            <p style={styles.subtitle}>
              Validating your reset link… If this doesn't clear, request a new
              link from the sign-in page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="label" htmlFor="new-password">
                  New password
                </label>
                <div style={styles.passwordWrap}>
                  <input
                    id="new-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    style={{ paddingRight: 64 }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    style={styles.pwToggle}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>

              {error && (
                <p className="field-error" role="alert" style={{ marginBottom: 12 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={loading}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: 20,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: {
    background: 'var(--color-teal)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 15,
    width: 38,
    height: 38,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLabel: {
    color: 'var(--color-navy)',
    fontWeight: 700,
    fontSize: 20,
    letterSpacing: '-0.02em',
  },
  card: { width: '100%', maxWidth: 420 },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-navy)',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    lineHeight: 1.6,
  },
  notice: {
    background: 'rgba(13,115,119,0.08)',
    color: 'var(--color-teal)',
    border: '1px solid rgba(13,115,119,0.25)',
    borderRadius: 'var(--radius, 6px)',
    padding: '10px 12px',
    fontSize: 13,
    marginBottom: 16,
  },
  passwordWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  pwToggle: {
    position: 'absolute',
    right: 8,
    background: 'transparent',
    border: 'none',
    color: 'var(--color-teal)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
  },
}
