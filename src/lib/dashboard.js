import { apiFetch } from './api.js'

export async function fetchTweets({ scope, search } = {}) {
  const params = new URLSearchParams()
  if (scope === 'mine') params.set('scope', 'mine')
  if (search?.trim()) params.set('search', search.trim())
  const qs = params.toString()

  const result = await apiFetch(`/api/tweets${qs ? `?${qs}` : ''}`)
  return result.ok ? { ok: true, tweets: result.data.tweets } : result
}

export async function fetchDashboardSummary() {
  const result = await apiFetch('/api/dashboard/summary')
  return result.ok ? { ok: true, stats: result.data.stats, breakdown: result.data.breakdown } : result
}

export async function postTweet(content) {
  const result = await apiFetch('/api/tweets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  return result.ok ? { ok: true, tweet: result.data.tweet } : result
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
