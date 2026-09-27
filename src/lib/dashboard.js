const API_BASE = import.meta.env.PROD ? '':'http://localhost:5000'

export async function fetchTweets({ scope, search } = {}) {
  const params = new URLSearchParams()
  if (scope === 'mine') params.set('scope', 'mine')
  if (search?.trim()) params.set('search', search.trim())
  const qs = params.toString()

  let res
  try {
    res = await fetch(`${API_BASE}/api/tweets${qs ? `?${qs}` : ''}`, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, tweets: data.tweets }
  return { ok: false, error: data.error }
}

export async function fetchDashboardSummary() {
  let res
  try {
    res = await fetch(`${API_BASE}/api/dashboard/summary`, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, stats: data.stats, breakdown: data.breakdown }
  return { ok: false, error: data.error }
}

export async function postTweet(content) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/tweets`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, tweet: data.tweet }
  return { ok: false, error: data.error }
}

export function formatRelativeTime(createdAt) {
  const timestamp = new Date(createdAt.replace(' ', 'T') + 'Z').getTime()
  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
