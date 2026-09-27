import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState(location.state?.username ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (ready && user) return <Navigate to="/home" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    const result = await login({ username, password })
    if (result.ok) {
      navigate('/home', { replace: true })
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Log in to Chirp</h1>

        {location.state?.justRegistered && (
          <p className="auth-success">
            Account created! Log in with your new credentials.
          </p>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-wide">
            Log in
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
