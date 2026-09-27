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

  async function register(details) {
    return await registerUser(details)
  }

  async function logout() {
    await logoutUser()
    setUser(null)
  }

  function updateUsername(username) {
    setUser((prev) => (prev ? { ...prev, username } : prev))
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateUsername }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
