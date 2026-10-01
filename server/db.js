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
    email TEXT,
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
    sentiment INTEGER,
    is_visible BOOLEAN NOT NULL DEFAULT true
  );
`

const CREATE_COMMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tweet_id INTEGER NOT NULL REFERENCES tweets(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL CHECK (length(content) <= 280),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sentiment INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    retry_claimed_at TIMESTAMPTZ
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

// Per-tweet switch: independent of the account-level tweets_visible column
// above — the two are combined with AND when checking visibility, so
// hiding one tweet doesn't require touching the account-wide flag.
export async function ensureTweetLevelVisibleColumn(db) {
  await db.query('ALTER TABLE tweets ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;')
}

// Nullable: existing accounts (created before this feature) won't have one
// until they set it themselves on the Profile page.
export async function ensureDisplayNameColumn(db) {
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;')
}

// Nullable, like display_name: existing accounts predate this column and have
// no email on file. The unique index still enforces one-account-per-email
// for everyone who does have one — a unique index (unlike a UNIQUE column
// constraint) treats every NULL as distinct, so legacy NULL rows don't clash.
export async function ensureEmailColumn(db) {
  await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;')
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);')
}

export async function initDb() {
  const db = getDb()
  await db.query(CREATE_USERS_TABLE)
  await db.query(CREATE_TWEETS_TABLE)
  await db.query(CREATE_COMMENTS_TABLE)
  await db.query('CREATE INDEX IF NOT EXISTS idx_comments_tweet_id ON comments (tweet_id);')
  await ensureSentimentColumn(db)
  await ensureRetryColumns(db)
  await ensureTweetsVisibleColumn(db)
  await ensureDisplayNameColumn(db)
  await ensureEmailColumn(db)
  await ensureTweetLevelVisibleColumn(db)
}
