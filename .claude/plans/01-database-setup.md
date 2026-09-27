# Plan: 01 — Express + SQLite Database Setup

## Context

Chirp is currently a frontend-only app: all "backend" behavior (accounts, sessions) is faked via `localStorage` in `src/lib/auth.js`. The project is beginning a backend migration, tracked as a series of specs under `.claude/specs/`. This is spec `01-database-setup.md` — the first step, which lays the **data layer and backend runtime foundation** (an Express server + a SQLite database) that all future steps (real auth, profile management, tweet feed persistence) will build on.

This step is intentionally narrow: it stands up `server/index.js` and `server/db.js`, a single `GET /api/health` route, and a seeded demo user in a real SQLite database (`chirp.db`). **It does not touch the frontend at all** — `src/lib/auth.js` and the React app are untouched; nothing wires the frontend to this new server yet. That wiring is future work.

Confirmed from exploration:
- Root `package.json` has `"type": "module"` (ESM), no `engines` field, npm is the package manager (package-lock.json present).
- No `server/` directory or any backend files exist yet anywhere in the repo.
- `.gitignore` is the standard Vite-generated one; it does not yet ignore `*.db` files.
- `.claude/specs/` currently only has this one spec file.

## Key design decision: sqlite3's callback API in an ESM project

The spec pins the exact dependency set (`express`, `sqlite3`, `bcryptjs` — no ORMs, no `better-sqlite3`, no `sqlite` promise-wrapper). The `sqlite3` package's `db.run`/`db.get`/`db.all` are callback-based. Since `server/*.js` inherits `"type": "module"` from the root `package.json` (Node resolves ESM/CJS by walking up to the nearest ancestor `package.json` — no nested `server/package.json` needed), we want a clean async story without adding a dependency.

**Approach:** open the `sqlite3.Database` connection once (singleton in `getDb()`), then attach promisified versions of `run`/`get`/`all` directly onto that instance using `util.promisify`, bound to the connection (`promisify(conn.run.bind(conn))` — binding is required because sqlite3's callback body relies on `this`). Every DB call in `initDb()`/`seedDb()` becomes a plain `await conn.runAsync(...)` / `await conn.getAsync(...)`. No `db.serialize()` needed — awaiting each call one at a time already serializes them; `serialize()` only matters for batches of un-awaited calls fired in the same tick.

`server/index.js` wraps startup in an `async function main()` with a `try/catch` around `initDb()`/`seedDb()`, rather than bare top-level `await`, so a DB init failure prints an explicit error and calls `process.exit(1)` deterministically (matches the spec's "crash gracefully with explicit console trace" requirement) instead of relying on Node's unhandled-rejection behavior.

## Files created

### `server/db.js`

```js
import sqlite3Pkg from 'sqlite3'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const sqlite3 = sqlite3Pkg.verbose()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DB_PATH = path.join(__dirname, '..', 'chirp.db')

let dbInstance = null

export function getDb() {
  if (dbInstance) return dbInstance

  const conn = new sqlite3.Database(DB_PATH)
  conn.runAsync = promisify(conn.run.bind(conn))
  conn.getAsync = promisify(conn.get.bind(conn))
  conn.allAsync = promisify(conn.all.bind(conn))

  dbInstance = conn
  return dbInstance
}

export function generateUserId() {
  return crypto.randomBytes(8).toString('hex')
}

const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`

const CREATE_TWEETS_TABLE = `
  CREATE TABLE IF NOT EXISTS tweets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL CHECK (length(content) <= 280),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`

export async function initDb() {
  const db = getDb()
  await db.runAsync('PRAGMA foreign_keys = ON;')
  await db.runAsync(CREATE_USERS_TABLE)
  await db.runAsync(CREATE_TWEETS_TABLE)
}

export async function seedDb() {
  const db = getDb()

  const row = await db.getAsync('SELECT COUNT(*) AS count FROM users;')
  if (row.count > 0) return

  const id = generateUserId()
  const username = 'mahesh'.toLowerCase()
  const passwordHash = await bcrypt.hash('mahesh', 10)

  await db.runAsync(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?);',
    [id, username, passwordHash]
  )
}
```

Notes:
- `DB_PATH` is resolved via `fileURLToPath(import.meta.url)` since ESM has no `__dirname` — this correctly handles Windows `file:///C:/...` URLs.
- `CHECK (length(content) <= 280)` enforces the tweet length constraint at the DB layer.
- `datetime('now')` default needs parens since it's a function call, not a literal.
- `seedDb()` checks `COUNT(*) > 0` on `users` (matches spec wording), so it stays idempotent even after real users register in later specs.
- Username lowercasing (`'mahesh'.toLowerCase()`) is a no-op on this literal but establishes the pattern the spec requires for all future mutation queries.
- All queries are parameterized (`?` placeholders) — no string interpolation.

### `server/index.js`

```js
import express from 'express'
import { initDb, seedDb } from './db.js'

const PORT = 5000

async function main() {
  try {
    await initDb()
    await seedDb()
  } catch (err) {
    console.error('Fatal: failed to initialize database.')
    console.error(err)
    process.exit(1)
  }

  const app = express()
  app.use(express.json())

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' })
  })

  app.listen(PORT, () => {
    console.log(`Chirp server listening on http://localhost:${PORT}`)
  })
}

main()
```

## Files changed

### `package.json`
- Added to `dependencies`: `express` (^5.2.1), `sqlite3` (^6.0.1), `bcryptjs` (^3.0.3).
- Added a script: `"server": "node server/index.js"`.

### `.gitignore`
Added a new section (after the existing "Editor directories and files" block):
```
# SQLite database files
*.db
*.db-journal
*.db-wal
*.db-shm
```

## Status

**Implemented.** `npm install` completed cleanly, `node --check` passed on both new files, and `npm run lint` showed no new warnings.

## Verification (to be run by the user)

1. `npm run server` — confirm:
   - Console prints `Chirp server listening on http://localhost:5000`.
   - `chirp.db` is created in the project root.
2. `curl http://localhost:5000/api/health` (or open in browser) — confirm it returns `{"status":"ok","database":"connected"}` with a 200.
3. Inspect `chirp.db` — confirm both `users` and `tweets` tables exist with the specified columns/constraints, and that a `mahesh` row exists in `users` with a bcrypt-looking `password_hash` (starts with `$2a$` or `$2b$`).
4. Stop the server, restart it (`npm run server` again) — confirm no crash, no duplicate `mahesh` row, and `/api/health` still responds correctly.
