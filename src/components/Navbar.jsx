import { Link } from 'react-router-dom'
import ChirpLogo from './ChirpLogo'
import './Navbar.css'

export default function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <ChirpLogo size={30} />
        <span>Chirp</span>
      </Link>

      <nav className="navbar-links">
        <Link to="/login" className="btn btn-outline">
          Log in
        </Link>
        <Link to="/register" className="btn btn-primary">
          Sign up
        </Link>
      </nav>
    </header>
  )
}
