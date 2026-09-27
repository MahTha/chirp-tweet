# Spec Document: 01-database-setup.md

## 1. Overview

Create an Express.js backend server infrastructure and set up a working SQLite database instance.

This step establishes the **data layer and backend runtime foundation** for the Chirp application.

All future features (Authentication, Registration, Profile Management, and the Tweet Feed) depend on this backend database layer being correctly implemented.

---

## 2. Depends on

Nothing — this is the first step of the backend migration.

---

## 3. Routes

- No new public API routes are exposed yet.
- A health check endpoint is implemented to verify server status.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns `{"status": "ok", "database": "connected"}` |

---

## 4. Database Schema (SQLite)

---

### A. users

| Column | Type | Constraints |
| --- | --- | --- |
| id | TEXT | Primary key — random 8-byte hex string generated in Node.js before insertion |
| username | TEXT | Unique, not null, lowercased |
| password_hash | TEXT | Not null |
| created_at | TEXT | Default datetime('now') |

---

### B. tweets

| Column | Type | Constraints |
| --- | --- | --- |
| id | INTEGER | Primary key, autoincrement |
| user_id | TEXT | Foreign key → users.id, not null |
| content | TEXT | Not null (max 280 characters) |
| created_at | TEXT | Default datetime('now') |

---

## 5. Functions to Implement (`server/db.js`)

---

### A. `getDb()`

- Opens a persistent connection to `chirp.db` in the project root directory.
- Sets:
    - `PRAGMA foreign_keys = ON;` to enforce cascading integrity.
- Returns the database connection instance object.

---

### B. `generateUserId()`

- Returns a random 8-byte hex string (`crypto.randomBytes(8).toString('hex')`, 16 characters) for use as a new user's `id`.
- Called explicitly inside Node.js before every `users` table insertion.

---

### C. `initDb()`

- Creates both tables (`users` and `tweets`) using `CREATE TABLE IF NOT EXISTS`.
- Safe to call multiple times without destroying data.
- Ensures the complete schema layout is ready before the API handles requests.

---

### D. `seedDb()`

- Checks if the `users` table already contains data.
    - If data exists → returns early (no duplication).
- Inserts one default demo account:
    - id: generated via `generateUserId()`
    - username: `mahesh`
    - password: `mahesh` (hashed securely via `bcryptjs`)

---

## 6. Changes to Backend Entry Point (`server/index.js`)

- Initialize an Express application listening on port `5000`.
- Import `initDb` and `seedDb` from `server/db.js`.
- Run `initDb()` and `seedDb()` during server initialization sequence before `app.listen()` executes.
- Configure basic global middleware rules: `express.json()` parser.

---

## 7. Files to Change

- None (this sets up new backend workspace structures).

---

## 8. Files to Create

- `server/index.js` → Base server configuration, startup lifecycle, health endpoint.
- `server/db.js` → SQLite initialization, connection context handling, schemas, and seeding.

---

## 9. Dependencies

Add these packages to a backend execution context or top-level project configurations:
- `express`
- `sqlite3`
- `bcryptjs`

---

## 10. Rules for Implementation

- No heavy ORMs (No Prisma, No Sequelize, No Mongoose). Use raw SQL queries execution via the `sqlite3` driver layer.
- Use **parameterized queries exclusively** (`?` tokens or named map properties) to protect against SQL injections.
- Enable `PRAGMA foreign_keys = ON` globally on every database open configuration sequence.
- All stored usernames must be systematically converted to lowercase strings (`.toLowerCase()`) before database mutation queries run.

---

## 11. Expected Behavior

- Launching the server automatically generates a local `chirp.db` file in your root workspace if it doesn't exist.
- Accessing `GET /api/health` yields a valid json payload payload with a `200` response flag status.
- Re-running the application binary over existing instances preserves database states without duplicate seed entries or collision errors.

---

## 12. Error Handling Expectations

- If database creation or schema processing fails on startup, crash the server application gracefully with an explicit console trace log message.

---

## 13. Definition of Done

- [ ] A persistent `chirp.db` file is successfully generated upon running the server application script.
- [ ] Both tables (`users` and `tweets`) are initialized with matching constraints.
- [ ] Seed user profile `mahesh` exists inside the database with a secured password hash.
- [ ] No duplicated records appear across multiple runtime server restarts.
- [ ] The health check API route returns a successful JSON signature.