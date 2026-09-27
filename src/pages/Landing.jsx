import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ChirpLogo from '../components/ChirpLogo'
import './Landing.css'

export default function Landing() {
  const { user, ready } = useAuth()

  if (ready && user) return <Navigate to="/home" replace />

  return (
    <div className="landing">
      <div className="landing-hero">
        <ChirpLogo size={64} />
        <h1>Happening now</h1>
        <h2>Join Chirp today.</h2>

        <div className="landing-actions">
          <Link to="/register" className="btn btn-primary btn-wide">
            Create account
          </Link>
          <Link to="/login" className="btn btn-outline btn-wide">
            Log in
          </Link>
        </div>
      </div>

      <div className="landing-side">
        <div className="landing-card">
          <span className="landing-tag">Trending</span>
          <h3>#FrontendOnly</h3>
          <p>No backend yet &mdash; just a fast, clean UI to build on.</p>
        </div>
        <div className="landing-card">
          <span className="landing-tag">Trending in Tech</span>
          <h3>#ReactRouter</h3>
          <p>Landing, register, login and a home feed &mdash; all wired up.</p>
        </div>
        <div className="landing-card">
          <span className="landing-tag">For you</span>
          <h3>#ChirpApp</h3>
          <p>A tiny Twitter-style clone, ready for real data later.</p>
        </div>
      </div>
    </div>
  )
}
