# Implementation Plan: 02 — Registration

## Context

Chirp's registration flow is currently 100% client-side: `registerUser()` in `src/lib/auth.js` reads/writes a fake `chirp.users` object in `localStorage`, and `Register.jsx` calls it synchronously. Step 1 (already implemented) stood up a real Express + SQLite backend (`server/index.js`, `server/db.js`) with a `users` table and a seeded `mahesh`/`mahesh` account, but nothing talks to it yet.

This step (per `.claude/specs/02-registration.md`) makes registration real: add `POST /api/auth/register` on the backend (validate, hash with bcrypt, insert), and rewire the frontend `register()` path to call it over the network instead of touching `localStorage`. Login stays on the old mock path for now — full session/login rewiring is explicitly deferred to Step 3 (`.claude/specs/03-login-logout.md`), which already covers replacing `login()`/`logout()`/`/home` guarding with real `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me` endpoints.

**Known transitional gap (expected, not a bug to fix here):** once this step lands, a newly-registered user exists only in `chirp.db`, not in the `chirp.users` localStorage blob that the still-mock `loginUser()` reads from — so they can't actually log in until Step 3 rewires login too. This matches the spec's own sequencing ("does not implement automated log-in sessions yet") and should just be called out, not worked around.

**Cross-origin decision (confirmed with user):** the frontend (Vite, `:5173`) will call the backend (Express, `:5000`) via an absolute URL, with the Express server sending manual CORS headers — no new npm packages, no Vite proxy.

## Files to change

### 1. `server/index.js` — new `POST /api/auth/register` route + CORS middleware

- Add a small CORS middleware before the routes:
  - `Access-Control-Allow-Origin: http://localhost:5173`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
  - Short-circuit `OPTIONS` preflight requests with `res.sendStatus(204)`.
- Import `getDb`, `generateUserId` from `./db.js` (already exported) and `bcrypt` from `bcryptjs`.
- Implement the handler:
  1. Read `{ username, password }` from `req.body`.
  2. Validate: both present (non-empty after `.trim()`), and `password.length >= 8`. On failure → `400` with the exact spec error string.
  3. `const key = username.trim().toLowerCase()`.
  4. Check for an existing user with that username (`SELECT id FROM users WHERE username = ?`, using `db.getAsync`). If found → `409` with the spec's "This username is already taken." message.
  5. Hash: `await bcrypt.hash(password, 10)`.
  6. Insert via `generateUserId()` + parameterized `INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)` (mirrors `seedDb()`'s existing pattern in `server/db.js`).
  7. On success → `201` with `{ success: true, message: 'User registered successfully' }` (spec has a typo, "21 Created" — using 201, the actual HTTP code).
  8. Wrap DB calls in try/catch → on unexpected error, `500` with a generic `{ success: false, error: 'Something went wrong. Please try again.' }` (not in spec, but needed so a DB failure doesn't crash the process or hang the frontend fetch).

### 2. `src/lib/auth.js` — replace mock `registerUser` with a network call

- Add `const API_BASE = 'http://localhost:5000'` at the top (reused by Step 3 later for login/logout/me).
- Replace `registerUser({ name, username, password })` with an `async function registerUser({ username, password })`:
  - `fetch(`${API_BASE}/api/auth/register`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ username, password }) })`.
  - Parse JSON body regardless of status (spec always returns a JSON payload with `success`/`error`).
  - Return `{ ok: true }` on `success: true`, else `{ ok: false, error: data.error }`.
  - Wrap the `fetch` itself in try/catch → on network failure (server not running), return `{ ok: false, error: 'Could not reach the server. Please try again.' }`.
- Leave `loginUser`, `getSession`, `clearSession`, `seedDefaultUser` untouched — those stay on the mock path until Step 3, per spec's explicit deferral.
- Per spec 6.B, only strip the `localStorage.getItem('chirp.users')` read/write logic that lived *inside registration*; nothing else in this file changes.

### 3. `src/context/AuthContext.jsx` — make `register()` async

- Change `register(details)` from `return registerUser(details)` to `return await registerUser(details)` inside an `async function register(details)` (so callers can `await` it and it always resolves to `{ ok, error }`, matching the new async `registerUser`).

### 4. `src/pages/Register.jsx` — await the async register call

- Make `handleSubmit` `async` and `await register({ username, password })`.
- **Drop `name` from the payload** — the `users` table has no name/display-name column (confirmed against both `server/db.js`'s schema and Step 3's spec, which also never adds one). Keep the "Name" input in the UI as-is for now (spec 3.B says the frontend view is "Existing, Unchanged Flow"/layout), it just won't be sent or persisted — this is a pre-existing scope gap in the spec, not something to silently fix by adding a `name` column.
- Everything else (password-confirmation check, error display, redirect to `/login` with `{ justRegistered: true, username }` state) stays as-is; only the call site becomes `await`ed and wrapped so `handleSubmit` doesn't need a loading spinner (not required by spec/DoD).

## Verification

1. Run `npm run server` (or `node server/index.js`) in one terminal, `npm run dev` in another.
2. From the `/register` page:
   - Register a brand-new username/password (≥8 chars) → expect redirect to `/login`, and confirm a new row exists in `chirp.db`'s `users` table (e.g. via `sqlite3 chirp.db "SELECT id, username, created_at FROM users;"`) with a bcrypt hash (`$2...`) in `password_hash`, not plaintext.
   - Re-submit the same username → expect the 409 error message shown inline on the form, no navigation, no duplicate row.
   - Submit a password under 8 characters → expect the 400 validation message shown inline, no row inserted.
   - Stop the backend server and submit → expect the network-failure error message shown inline instead of an unhandled crash.
3. `npm run lint` to catch anything oxlint flags in the touched files.
