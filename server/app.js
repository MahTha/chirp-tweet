import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { waitUntil } from '@vercel/functions'
import { getDb, generateUserId } from './db.js'
import { signToken, requireAuth, setSessionCookie, SESSION_COOKIE } from './middleware/auth.js'
import { resolveTweetSentiment, MAX_SENTIMENT_RETRIES } from './sentiment.js'

const DEFAULT_TWEETS_LIMIT = 50
const MAX_TWEETS_LIMIT = 100
const MIN_PASSWORD_LENGTH = 8
const RETRY_BATCH_SIZE = 10
const RETRY_CONCURRENCY = 3
const RETRY_CLAIM_STALE_MINUTES = 2

// Runs fn over items with at most `limit` running at once — enough
// parallelism to not be slow, without overloading the sentiment service.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}

function normalizeSentiment(value) {
  if (value === null || value === undefined) return null
  return value === 1 || value === true
}

function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_PATTERN.test(email.trim())
}

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.'

function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export function createApp() {
  const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
  const app = express()
  app.set('trust proxy', 1)

  app.use(express.json())
  app.use(cookieParser())
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'))
  }

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CLIENT_ORIGIN)
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    res.header('Access-Control-Allow-Credentials', 'true')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts. Please try again later.' },
  })

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', backend: 'running' })
  })

  app.post(
    '/api/auth/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { name, username, email, password } = req.body ?? {}
      const displayName = typeof name === 'string' ? name.trim() : ''

      if (!displayName || !username?.trim() || !email?.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Name, username, and email are required fields.',
        })
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, error: 'Enter a valid email address.' })
      }

      if (!isValidPassword(password)) {
        return res.status(400).json({ success: false, error: PASSWORD_REQUIREMENTS_MESSAGE })
      }

      const key = normalizeUsername(username)
      const emailKey = normalizeEmail(email)
      const db = getDb()

      const existing = await db.getAsync(
        'SELECT username, email FROM users WHERE username = $1 OR email = $2;',
        [key, emailKey]
      )
      if (existing) {
        const error =
          existing.username === key ? 'This username is already taken.' : 'This email is already in use.'
        return res.status(409).json({ success: false, error })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      await db.runAsync(
        'INSERT INTO users (id, username, email, password_hash, display_name) VALUES ($1, $2, $3, $4, $5);',
        [generateUserId(), key, emailKey, passwordHash, displayName]
      )

      res.status(201).json({ success: true, message: 'User registered successfully' })
    })
  )

  app.post(
    '/api/auth/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { identifier, password } = req.body ?? {}

      if (!identifier?.trim() || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username or email, and password, are required fields.',
        })
      }

      // Login accepts either a username or an email in the same field — both
      // are normalized to lowercase before comparison, matching how each is
      // stored, so a single lookup against either column works.
      const key = identifier.trim().toLowerCase()
      const db = getDb()

      const user = await db.getAsync(
        'SELECT id, username, password_hash, display_name FROM users WHERE username = $1 OR email = $1;',
        [key]
      )

      const valid = user && (await bcrypt.compare(password, user.password_hash))
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials.',
        })
      }

      const token = signToken({ id: user.id, username: user.username, displayName: user.display_name })
      setSessionCookie(res, token)

      res.json({
        success: true,
        user: { id: user.id, username: user.username, displayName: user.display_name },
      })
    })
  )

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(SESSION_COOKIE)
    res.json({ success: true })
  })

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ success: true, user: req.user })
  })

  app.get(
    '/api/users/profile',
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = getDb()

      const profile = await db.getAsync(
        'SELECT id, username, email, created_at, tweets_visible, display_name FROM users WHERE id = $1;',
        [req.user.id]
      )

      if (!profile) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' })
      }

      res.json({ success: true, profile })
    })
  )

  app.put(
    '/api/users/display-name',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { displayName } = req.body ?? {}
      const trimmed = typeof displayName === 'string' ? displayName.trim() : ''

      if (!trimmed) {
        return res.status(400).json({ success: false, error: 'Name is required.' })
      }

      const db = getDb()
      await db.runAsync('UPDATE users SET display_name = $1 WHERE id = $2;', [trimmed, req.user.id])

      const token = signToken({ id: req.user.id, username: req.user.username, displayName: trimmed })
      setSessionCookie(res, token)

      res.json({ success: true, displayName: trimmed })
    })
  )

  app.put(
    '/api/users/password',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { currentPassword, newPassword } = req.body ?? {}

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required fields.',
        })
      }

      const db = getDb()

      const user = await db.getAsync('SELECT password_hash FROM users WHERE id = $1;', [req.user.id])
      const valid = user && (await bcrypt.compare(currentPassword, user.password_hash))
      if (!valid) {
        return res.status(401).json({ success: false, error: 'Current password is incorrect.' })
      }

      if (!isValidPassword(newPassword)) {
        return res.status(400).json({ success: false, error: PASSWORD_REQUIREMENTS_MESSAGE })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await db.runAsync('UPDATE users SET password_hash = $1 WHERE id = $2;', [
        passwordHash,
        req.user.id,
      ])

      res.json({ success: true })
    })
  )

  app.put(
    '/api/users/tweets-visibility',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { visible } = req.body ?? {}

      if (typeof visible !== 'boolean') {
        return res.status(400).json({ success: false, error: 'visible must be a boolean.' })
      }

      const db = getDb()
      await db.runAsync('UPDATE users SET tweets_visible = $1 WHERE id = $2;', [visible, req.user.id])

      res.json({ success: true, tweetsVisible: visible })
    })
  )

  app.get(
    '/api/dashboard/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = getDb()

      // Same visibility rule as GET /api/tweets: a tweet counts if it's the
      // viewer's own, or its sentiment came back positive and its author
      // hasn't switched their tweets to invisible.
      const stats = await db.getAsync(
        `SELECT COUNT(*)::int as total_tweets, COUNT(DISTINCT tweets.user_id)::int as total_authors
         FROM tweets
         JOIN users ON tweets.user_id = users.id
         WHERE tweets.user_id = $1 OR (tweets.sentiment = 1 AND users.tweets_visible = true AND tweets.is_visible = true);`,
        [req.user.id]
      )
      const breakdown = await db.allAsync(
        `SELECT users.username, COUNT(tweets.id)::int as tweet_count
         FROM tweets
         JOIN users ON tweets.user_id = users.id
         WHERE tweets.user_id = $1 OR (tweets.sentiment = 1 AND users.tweets_visible = true AND tweets.is_visible = true)
         GROUP BY users.username
         ORDER BY tweet_count DESC;`,
        [req.user.id]
      )

      res.json({
        success: true,
        stats: { totalTweets: stats.total_tweets, totalAuthors: stats.total_authors },
        breakdown,
      })
    })
  )

  app.get(
    '/api/tweets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = getDb()
      const { scope, search } = req.query

      const conditions = []
      const params = []

      if (scope === 'mine') {
        params.push(req.user.id)
        conditions.push(`tweets.user_id = $${params.length}`)
      } else {
        // Everyone always sees their own tweets. Other users' tweets only
        // show up once their sentiment check comes back positive — pending
        // (null) or negative tweets stay invisible to everyone but the author
        // — and only if that author hasn't switched their tweets to invisible.
        params.push(req.user.id)
        conditions.push(
          `(tweets.user_id = $${params.length} OR (tweets.sentiment = 1 AND users.tweets_visible = true AND tweets.is_visible = true))`
        )
      }

      const term = typeof search === 'string' ? search.trim() : ''
      if (term) {
        params.push(`%${term}%`)
        conditions.push(`tweets.content ILIKE $${params.length}`)
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

      const rawLimit = Number.parseInt(req.query.limit, 10)
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_TWEETS_LIMIT) : DEFAULT_TWEETS_LIMIT

      const rawOffset = Number.parseInt(req.query.offset, 10)
      const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0

      params.push(limit + 1, offset)
      const limitParamIndex = params.length - 1
      const offsetParamIndex = params.length

      // Fetch one extra row to know whether there's a next page without a second COUNT query.
      const rows = await db.allAsync(
        `SELECT tweets.id, tweets.content, tweets.created_at, tweets.sentiment, tweets.is_visible, tweets.user_id, users.username
         FROM tweets
         JOIN users ON tweets.user_id = users.id
         ${whereClause}
         ORDER BY tweets.created_at DESC, tweets.id DESC
         LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex};`,
        params
      )

      const tweets = rows
        .slice(0, limit)
        .map((row) => ({ ...row, sentiment: normalizeSentiment(row.sentiment) }))

      res.json({ success: true, tweets, hasMore: rows.length > limit })
    })
  )

  app.post(
    '/api/tweets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { content } = req.body ?? {}
      const trimmed = typeof content === 'string' ? content.trim() : ''

      if (!trimmed || trimmed.length > 280) {
        return res.status(400).json({
          success: false,
          error: 'Tweet content is required and must be 280 characters or fewer.',
        })
      }

      const db = getDb()

      // Store immediately with sentiment unknown — the author sees their own
      // tweet right away instead of waiting on the sentiment service.
      const id = await db.runInsertAsync(
        'INSERT INTO tweets (user_id, content, sentiment) VALUES ($1, $2, $3) RETURNING id;',
        [req.user.id, trimmed, null]
      )
      const row = await db.getAsync(
        'SELECT id, content, created_at, sentiment FROM tweets WHERE id = $1;',
        [id]
      )

      res.status(201).json({
        success: true,
        tweet: { ...row, sentiment: normalizeSentiment(row.sentiment), username: req.user.username },
      })

      // Sentiment is checked after responding. A positive result becomes
      // visible to other users via the GET /api/tweets filter; a negative
      // result is deleted outright — for the author too — so negative
      // tweets never pile up; a still-unknown result stays pending and gets
      // picked up again later by the retry cron (POST /api/cron/retry-sentiment).
      const sentimentCheck = resolveTweetSentiment(db, { id, content: trimmed }).catch((err) =>
        console.error('Failed to record tweet sentiment:', err)
      )

      try {
        waitUntil(sentimentCheck)
      } catch {
        // Not running on Vercel (e.g. local `npm run server`) — the process
        // stays alive on its own, so sentimentCheck above still completes.
      }
    })
  )

  app.put(
    '/api/tweets/:id/visibility',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { visible } = req.body ?? {}

      if (typeof visible !== 'boolean') {
        return res.status(400).json({ success: false, error: 'visible must be a boolean.' })
      }

      const tweetId = Number.parseInt(req.params.id, 10)
      if (!Number.isFinite(tweetId)) {
        return res.status(400).json({ success: false, error: 'Invalid tweet id.' })
      }

      const db = getDb()
      const row = await db.getAsync(
        // Ownership is enforced by the WHERE clause itself, not a separate
        // SELECT-then-check — atomic, and avoids a race between the two steps.
        'UPDATE tweets SET is_visible = $1 WHERE id = $2 AND user_id = $3 RETURNING id;',
        [visible, tweetId, req.user.id]
      )

      if (!row) {
        return res.status(404).json({ success: false, error: 'Tweet not found.' })
      }

      res.json({ success: true, isVisible: visible })
    })
  )

  app.post(
    '/api/cron/retry-sentiment',
    asyncHandler(async (req, res) => {
      // No logged-in user on this route — it's called by Supabase's
      // scheduled cron job, not a browser, so it's protected by a shared
      // secret instead of requireAuth. Fails closed if the secret isn't set.
      const secret = process.env.CRON_SECRET
      if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ success: false, error: 'Not authorized.' })
      }

      const db = getDb()

      // Claim a small batch atomically: FOR UPDATE SKIP LOCKED means an
      // overlapping run grabs different rows instead of double-processing
      // the same ones. A stale claim (from a run that never finished) frees
      // up again after a couple of minutes.
      const claimed = await db.allAsync(
        `UPDATE tweets SET retry_claimed_at = now()
         WHERE id IN (
           SELECT id FROM tweets
           WHERE sentiment IS NULL
             AND retry_count < $1
             AND (retry_claimed_at IS NULL OR retry_claimed_at < now() - interval '${RETRY_CLAIM_STALE_MINUTES} minutes')
           ORDER BY created_at
           LIMIT $2
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, content;`,
        [MAX_SENTIMENT_RETRIES, RETRY_BATCH_SIZE]
      )

      const outcomes = await mapWithConcurrency(claimed, RETRY_CONCURRENCY, (tweet) =>
        resolveTweetSentiment(db, tweet)
      )

      res.json({ success: true, claimed: claimed.length, outcomes })
    })
  )

  app.use((err, req, res, _next) => {
    console.error(err)
    const status = err.status || err.statusCode || 500
    if (status >= 500) {
      return res.status(status).json({ success: false, error: 'Something went wrong. Please try again.' })
    }
    res.status(status).json({ success: false, error: err.message || 'Bad request.' })
  })

  return app
}
