import { apiFetch } from './api.js'

export async function fetchTweets({ scope, search } = {}) {
  const params = new URLSearchParams()
  if (scope === 'mine') params.set('scope', 'mine')
  if (search?.trim()) params.set('search', search.trim())
  const qs = params.toString()

  const result = await apiFetch(`/api/tweets${qs ? `?${qs}` : ''}`)
  return result.ok ? { ok: true, tweets: result.data.tweets } : result
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
  const date = new Date(createdAt)
  const now = new Date()

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (isSameDay(date, now)) return `Today, ${time}`
  if (isSameDay(date, yesterday)) return `Yesterday, ${time}`

  const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${dateLabel}, ${time}`
}
