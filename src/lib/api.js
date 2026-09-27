export const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:5000'

export async function apiFetch(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...options })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, data }
  return { ok: false, error: data.error }
}
