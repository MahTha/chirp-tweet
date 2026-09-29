import pg from 'pg'
import crypto from 'node:crypto'

const { Pool } = pg

let pool = null

export function getDb() {
  if (pool) return pool

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  })

  pool.getAsync = async (sql, params = []) => {
    const result = await pool.query(sql, params)
    return result.rows[0]
  }
  pool.allAsync = async (sql, params = []) => {
    const result = await pool.query(sql, params)
    return result.rows
  }
  pool.runAsync = async (sql, params = []) => {
    await pool.query(sql, params)
  }
  pool.runInsertAsync = async (sql, params = []) => {
    const result = await pool.query(sql, params)
    return result.rows[0].id
  }

  return pool
}

export function generateUserId() {
  return crypto.randomBytes(8).toString('hex')
}

const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    tweets_visible BOOLEAN NOT NULL DEFAULT true,
    display_name TEXT
  );
`

const CREATE_TWEETS_TABLE = `
  CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL CHECK (length(content) <= 280),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sentiment INTEGER
  );
`

export async function ensureSentimentColumn(db) {
  await db.query('ALTER TABLE tweets ADD COLUMN IF NOT EXISTS sentiment INTEGER;')
}

export async function ensureRetryColumns(db) {
  await db.query('ALTER TABLE tweets ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;')
  await db.query('ALTER TABLE tweets ADD COLUMN IF NOT EXISTS retry_claimed_at TIMESTAMPTZ;')
  // Partial index: only tracks still-pending (sentiment IS NULL) rows, so the
  // retry cron's claim query stays fast regardless of how large the table gets.
  await db.query(
    'CREATE INDEX IF NOT EXISTS idx_tweets_pending ON tweets (created_at) WHERE sentiment IS NULL;'
  )
}

// Account-level switch: hides all of a user's tweets from everyone but the
// author, regardless of sentiment. Independent of any future per-tweet
// visibility column — the two are combined with AND, so neither can override
// the other into being visible.
export async function ensureTweetsVisibleColumn(db) {
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS tweets_visible BOOLEAN NOT NULL DEFAULT true;')
}

// Nullable: existing accounts (created before this feature) won't have one
// until they set it themselves on the Profile page.
export async function ensureDisplayNameColumn(db) {
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;')
}

export async function initDb() {
  const db = getDb()
  await db.query(CREATE_USERS_TABLE)
  await db.query(CREATE_TWEETS_TABLE)
  await ensureSentimentColumn(db)
  await ensureRetryColumns(db)
  await ensureTweetsVisibleColumn(db)
  await ensureDisplayNameColumn(db)
}
