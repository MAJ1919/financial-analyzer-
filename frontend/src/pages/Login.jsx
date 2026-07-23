import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../services/supabaseClient'

/**
 * Combined sign-in / sign-up / forgot-password screen.
 *
 * A single centered auth card with three modes toggled by local state:
 *   'signin'  — email + password → session
 *   'signup'  — email + password → (email confirmation pending)
 *   'forgot'  — email → password-reset email sent
 *
 * All auth goes directly to Supabase (anon key); the backend is never touched
 * here. On a successful sign-in the auth listener in authStore updates the
 * session and the ProtectedRoute lets the user through.
 */
export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('') // success / info (e.g. confirm email)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()
  // Return the user to wherever they were headed before the auth redirect.
  const from = location.state?.from?.pathname || '/'

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim()) {
      setError('Please enter your email.')
      return
    }
    if (mode !== 'forgot' && !password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) throw error
        navigate(from, { replace: true })
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (error) throw error
        // When email confirmation is on, signUp returns a user but NO session.
        if (data.session) {
          navigate(from, { replace: true })
        } else {
          setNotice(
            'Check your email to confirm your account, then sign in.'
          )
          setMode('signin')
          setPassword('')
        }
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${window.location.origin}/reset-password` }
        )
        if (error) throw error
        setNotice(
          'If an account exists for that email, a password-reset link is on its way.'
        )
        setMode('signin')
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    signin: 'Sign in',
    signup: 'Create your account',
    forgot: 'Reset your password',
  }
  const ctaLabels = {
    signin: 'Sign in',
    signup: 'Create account',
    forgot: 'Send reset link',
  }

  return (
    <div style={styles.page}>
      <div style={styles.brand}>
        <span style={styles.brandIcon}>FA</span>
        <span style={styles.brandLabel}>FinAnalyzer</span>
      </div>

      <div className="card" style={styles.card}>
        <div className="card-body">
          <h1 style={styles.title}>{titles[mode]}</h1>
          <p style={styles.subtitle}>
            Financial Statement Analysis &amp; Business Valuation
          </p>

          {notice && (
            <p style={styles.notice} role="status">
              {notice}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
              />
            </div>

            {mode !== 'forgot' && (
              <div className="form-group">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div style={styles.passwordWrap}>
                  <input
                    id="password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={
                      mode === 'signup' ? 'new-password' : 'current-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    style={{ paddingRight: 64 }}
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
            )}

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
              {loading ? 'Please wait…' : ctaLabels[mode]}
            </button>
          </form>

          {/* Secondary links — mode switches */}
          <div style={styles.links}>
            {mode === 'signin' && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot password?
                </button>
                <span style={styles.linkText}>
                  New here?{' '}
                  <button
                    type="button"
                    style={styles.inlineLink}
                    onClick={() => switchMode('signup')}
                  >
                    Create an account
                  </button>
                </span>
              </>
            )}
            {mode === 'signup' && (
              <span style={styles.linkText}>
                Already have an account?{' '}
                <button
                  type="button"
                  style={styles.inlineLink}
                  onClick={() => switchMode('signin')}
                >
                  Sign in
                </button>
              </span>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => switchMode('signin')}
              >
                ← Back to sign in
              </button>
            )}
          </div>
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
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
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
  card: {
    width: '100%',
    maxWidth: 420,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-navy)',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
    marginBottom: 24,
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
  passwordWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
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
  links: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  linkText: {
    fontSize: 13,
    color: 'var(--color-text-muted)',
  },
  inlineLink: {
    background: 'transparent',
    border: 'none',
    color: 'var(--color-teal)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    padding: 0,
  },
}
