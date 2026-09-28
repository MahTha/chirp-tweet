import express from 'express'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { waitUntil } from '@vercel/functions'
import { getDb, generateUserId } from './db.js'
import { signToken, requireAuth, setSessionCookie, SESSION_COOKIE } from './middleware/auth.js'
import { fetchSentiment } from './sentiment.js'

const DEFAULT_TWEETS_LIMIT = 50
const MAX_TWEETS_LIMIT = 100
const MIN_PASSWORD_LENGTH = 8

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
    res.json({ status: 'ok', database: 'connected' })
  })

  app.post(
    '/api/auth/register',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {}

      if (!username?.trim() || !password || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `Username and password are required fields. Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        })
      }

      const key = normalizeUsername(username)
      const db = getDb()

      const existing = await db.getAsync('SELECT id FROM users WHERE username = $1;', [key])
      if (existing) {
        return res.status(409).json({ success: false, error: 'This username is already taken.' })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      await db.runAsync('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3);', [
        generateUserId(),
        key,
        passwordHash,
      ])

      res.status(201).json({ success: true, message: 'User registered successfully' })
    })
  )

  app.post(
    '/api/auth/login',
    authLimiter,
    asyncHandler(async (req, res) => {
      const { username, password } = req.body ?? {}

      if (!username?.trim() || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required fields.',
        })
      }

      const key = normalizeUsername(username)
      const db = getDb()

      const user = await db.getAsync(
        'SELECT id, username, password_hash FROM users WHERE username = $1;',
        [key]
      )

      const valid = user && (await bcrypt.compare(password, user.password_hash))
      if (!valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username or password credentials.',
        })
      }

      const token = signToken(user)
      setSessionCookie(res, token)

      res.json({ success: true, user: { id: user.id, username: user.username } })
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

      const profile = await db.getAsync('SELECT id, username, created_at FROM users WHERE id = $1;', [
        req.user.id,
      ])

      if (!profile) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' })
      }

      res.json({ success: true, profile })
    })
  )

  app.put(
    '/api/users/profile',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { username } = req.body ?? {}

      if (!username?.trim()) {
        return res.status(400).json({ success: false, error: 'Username is required.' })
      }

      const key = normalizeUsername(username)
      const db = getDb()

      const existing = await db.getAsync('SELECT id FROM users WHERE username = $1 AND id != $2;', [
        key,
        req.user.id,
      ])
      if (existing) {
        return res.status(409).json({ success: false, error: 'This username is already taken.' })
      }

      await db.runAsync('UPDATE users SET username = $1 WHERE id = $2;', [key, req.user.id])

      const token = signToken({ id: req.user.id, username: key })
      setSessionCookie(res, token)

      res.json({ success: true, profile: { id: req.user.id, username: key } })
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

      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          success: false,
          error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        })
      }

      const passwordHash = await bcrypt.hash(newPassword, 10)
      await db.runAsync('UPDATE users SET password_hash = $1 WHERE id = $2;', [
        passwordHash,
        req.user.id,
      ])

      res.json({ success: true })
    })
  )

  app.get(
    '/api/dashboard/summary',
    requireAuth,
    asyncHandler(async (req, res) => {
      const db = getDb()

      // Same visibility rule as GET /api/tweets: a tweet counts if it's the
      // viewer's own, or its sentiment came back positive.
      const stats = await db.getAsync(
        `SELECT COUNT(*)::int as total_tweets, COUNT(DISTINCT user_id)::int as total_authors
         FROM tweets
         WHERE user_id = $1 OR sentiment = 1;`,
        [req.user.id]
      )
      const breakdown = await db.allAsync(
        `SELECT users.username, COUNT(tweets.id)::int as tweet_count
         FROM tweets
         JOIN users ON tweets.user_id = users.id
         WHERE tweets.user_id = $1 OR tweets.sentiment = 1
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
        // (null) or negative tweets stay invisible to everyone but the author.
        params.push(req.user.id)
        conditions.push(`(tweets.user_id = $${params.length} OR tweets.sentiment = 1)`)
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
        `SELECT tweets.id, tweets.content, tweets.created_at, tweets.sentiment, users.username
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
      // visible to other users via the GET /api/tweets filter; a still-
      // unknown result (service down/timed out) stays invisible to everyone
      // but the author; a negative result is deleted outright — for the
      // author too — so negative tweets never pile up in the database.
      const sentimentCheck = fetchSentiment(trimmed)
        .then((sentiment) => {
          if (sentiment === null) return
          if (sentiment === false) {
            return db.runAsync('DELETE FROM tweets WHERE id = $1;', [id])
          }
          return db.runAsync('UPDATE tweets SET sentiment = $1 WHERE id = $2;', [1, id])
        })
        .catch((err) => console.error('Failed to record tweet sentiment:', err))

      try {
        waitUntil(sentimentCheck)
      } catch {
        // Not running on Vercel (e.g. local `npm run server`) — the process
        // stays alive on its own, so sentimentCheck above still completes.
      }
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
