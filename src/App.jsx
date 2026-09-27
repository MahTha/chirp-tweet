import { Route, Routes, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import ThemeToggle from './components/ThemeToggle'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Home from './pages/Home'
import Profile from './pages/Profile'
import TermsOfService from './pages/legal/TermsOfService'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import CookiePolicy from './pages/legal/CookiePolicy'
import About from './pages/company/About'
import HelpCenter from './pages/company/HelpCenter'
import Accessibility from './pages/company/Accessibility'
import AdsInfo from './pages/company/AdsInfo'
import Careers from './pages/company/Careers'
import BrandResources from './pages/company/BrandResources'
import Developers from './pages/company/Developers'

export default function App() {
  return (
    <AuthProvider>
      <ThemeToggle />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/ads" element={<AdsInfo />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/brand" element={<BrandResources />} />
          <Route path="/developers" element={<Developers />} />
        </Route>
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
