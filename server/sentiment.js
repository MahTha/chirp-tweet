const DEFAULT_SENTIMENT_API_URL = 'http://localhost:3001/api/sentiment'
// The sentiment service decides how long analysis takes — a tweet's
// negative/positive outcome must be based on its real answer, not a
// short cutoff. This is a generous safety net (avoids hanging forever
// on a truly dead connection), not a realistic analysis-time budget.
const DEFAULT_TIMEOUT_MS = 35_000

// Never throws. Returns true/false on a well-formed response, null on any
// failure: network error, non-2xx status, malformed JSON body, missing/
// non-boolean `sentiment` field, or timeout.
export async function fetchSentiment(content, opts = {}) {
  const url = opts.url ?? process.env.SENTIMENT_API_URL ?? DEFAULT_SENTIMENT_API_URL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tweet: content }),
      signal: controller.signal,
    })

    if (!res.ok) return null

    const body = await res.json()
    const sentiment = body?.sentiment
    return sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral' ? body.sentiment : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// After this many attempts with no clear answer, a tweet is deleted rather
// than left pending forever.
export const MAX_SENTIMENT_RETRIES = 3

// Checks one tweet's sentiment and persists the outcome. Used both right
// after posting and by every later retry-cron pass, so the three outcomes
// (positive/negative/still-unknown) are handled in exactly one place.
export async function resolveSentiment(db, table, { id, content }) {
  const sentiment = await fetchSentiment(content)

  if (sentiment === 'positive' || sentiment === 'neutral') {
    await db.runAsync(`UPDATE ${table} SET sentiment = 1 WHERE id = $1;`, [id])
    return sentiment
  }

  if (sentiment === 'negative') {
    await db.runAsync(`DELETE FROM ${table} WHERE id = $1;`, [id])
    return 'negative'
  }

  // Still unknown: count this attempt, and give up once the limit is hit.
  const row = await db.getAsync(
    `UPDATE ${table} SET retry_count = retry_count + 1 WHERE id = $1 RETURNING retry_count;`,
    [id]
  )
  if (row.retry_count >= MAX_SENTIMENT_RETRIES) {
    await db.runAsync(`DELETE FROM ${table} WHERE id = $1;`, [id])
    return 'gave-up'
  }
  return 'pending'
}
