import { apiFetch } from './api.js'

export async function registerUser({ name, username, email, password }) {
  const result = await apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, email, password }),
  })
  return result.ok ? { ok: true } : result
}

export async function loginUser({ identifier, password }) {
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  })
  return result.ok ? { ok: true, user: result.data.user } : result
}

export async function fetchSession() {
  const result = await apiFetch('/api/auth/me')
  return result.ok ? result.data.user : null
}

export async function logoutUser() {
  await apiFetch('/api/auth/logout', { method: 'POST' })
}

export async function fetchProfile() {
  const result = await apiFetch('/api/users/profile')
  return result.ok ? { ok: true, profile: result.data.profile } : result
}

export async function changePassword({ currentPassword, newPassword }) {
  const result = await apiFetch('/api/users/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  return result.ok ? { ok: true } : result
}

export async function updateDisplayName({ displayName }) {
  const result = await apiFetch('/api/users/display-name', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  })
  return result.ok ? { ok: true, displayName: result.data.displayName } : result
}

export async function updateTweetsVisibility({ visible }) {
  const result = await apiFetch('/api/users/tweets-visibility', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visible }),
  })
  return result.ok ? { ok: true, tweetsVisible: result.data.tweetsVisible } : result
}
