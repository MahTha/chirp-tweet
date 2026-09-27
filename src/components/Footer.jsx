import { Link } from 'react-router-dom'
import ChirpLogo from './ChirpLogo'
import './Footer.css'

const LINKS = [
  { label: 'About', to: '/about' },
  { label: 'Help Center', to: '/help' },
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Cookie Policy', to: '/cookies' },
  { label: 'Accessibility', to: '/accessibility' },
  { label: 'Ads Info', to: '/ads' },
  { label: 'Careers', to: '/careers' },
  { label: 'Brand Resources', to: '/brand' },
  { label: 'Developers', to: '/developers' },
]

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <ChirpLogo size={22} />
          <div>
            <strong>Chirp</strong>
            <span>See what's happening, right now.</span>
          </div>
        </div>

        <nav className="footer-links">
          {LINKS.map((link, i) => (
            <span key={link.label} className="footer-link-item">
              <Link to={link.to}>{link.label}</Link>
              {i < LINKS.length - 1 && <span className="footer-dot">&middot;</span>}
            </span>
          ))}
        </nav>
      </div>

      <div className="footer-divider" />

      <p className="footer-copy">&copy; {new Date().getFullYear()} Chirp Corp.</p>
    </footer>
  )
}
