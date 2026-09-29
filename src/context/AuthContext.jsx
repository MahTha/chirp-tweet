import { createContext, useContext, useEffect, useState } from 'react'
import {
  registerUser,
  loginUser,
  fetchSession,
  logoutUser,
} from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetchSession()
      .then(setUser)
      .finally(() => setReady(true))
  }, [])

  async function login(credentials) {
    const result = await loginUser(credentials)
    if (result.ok) setUser(result.user)
    return result
  }

  async function logout() {
    await logoutUser()
    setUser(null)
  }

  function updateDisplayName(displayName) {
    setUser((prev) => (prev ? { ...prev, displayName } : prev))
  }

  return (
    <AuthContext.Provider
      value={{ user, ready, login, register: registerUser, logout, updateDisplayName }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
