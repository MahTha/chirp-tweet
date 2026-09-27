const API_BASE = import.meta.env.PROD ? '': 'http://localhost:5000'

export async function registerUser({ username, password }) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true }
  return { ok: false, error: data.error }
}

export async function loginUser({ username, password }) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, user: data.user }
  return { ok: false, error: data.error }
}

export async function fetchSession() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
    if (!res.ok) return null
    const data = await res.json()
    return data.success ? data.user : null
  } catch {
    return null
  }
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // logout should clear local state regardless of network outcome
  }
}

export async function fetchProfile() {
  let res
  try {
    res = await fetch(`${API_BASE}/api/users/profile`, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, profile: data.profile }
  return { ok: false, error: data.error }
}

export async function updateProfile({ username }) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, profile: data.profile }
  return { ok: false, error: data.error }
}

export async function changePassword({ currentPassword, newPassword }) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/users/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true }
  return { ok: false, error: data.error }
}
