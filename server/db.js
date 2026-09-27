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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

export async function initDb() {
  const db = getDb()
  await db.query(CREATE_USERS_TABLE)
  await db.query(CREATE_TWEETS_TABLE)
  await ensureSentimentColumn(db)
}
