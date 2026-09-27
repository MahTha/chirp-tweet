# Implementation Plan: 03-login-logout.md

Source spec: `.claude/specs/03-login-logout.md`

## 0. Current state (verified against the repo, not assumed from the spec)

Steps 1 and 2 are already implemented:
- `server/db.js` — `getDb()`, `generateUserId()`, `initDb()`, `seedDb()` exist. `users` table has `id`, `username`, `password_hash`, `created_at`. Seeded demo user `mahesh`/`mahesh` with a bcrypt hash.
- `server/index.js` — Express app on port 5000, CORS locked to `http://localhost:5173`, `express.json()`, `GET /api/health`, `POST /api/auth/register` (bcrypt hash, 409 on duplicate, 400 on short password).
- `src/lib/auth.js` — `registerUser()` already calls the real API. But `loginUser()`, `getSession()`, `clearSession()`, `seedDefaultUser()` still read/write a **separate, disconnected** `chirp.users` / `chirp.session` localStorage blob with **plaintext password comparison** — this is dead code left over from before the backend existed, and it's what this step replaces.
- `src/context/AuthContext.jsx` — `ready` is hardcoded `true`; `user` is seeded synchronously from `getSession()`.
- `src/pages/Login.jsx`, `src/pages/Home.jsx` — call `login()`/`logout()` synchronously.

This plan only touches the login/logout/session-check surface. `registerUser()` and the registration flow are out of scope and unchanged.

## 1. Design decision: JWT in an httpOnly cookie (not `express-session`)

The spec allows either. Going with `jsonwebtoken` + an httpOnly cookie because:
- No session store needed (no Redis/DB table for sessions) — stays consistent with this project's "no heavy infra" pattern (rule from step 1: no ORMs, raw SQL only).
- Stateless verification means `GET /api/auth/me` and any future `requireAuth`-guarded route just verifies the cookie, no DB round-trip required.
- httpOnly cookie (vs. `localStorage` token) avoids exposing the token to JS/XSS, and satisfies "cookie-based or token-based" from the spec.

Consequence: the browser `fetch` calls need `credentials: 'include'`, and the server CORS middleware needs `Access-Control-Allow-Credentials: true` (can't use `*` for origin with credentials — it's already locked to the explicit Vite origin, so this is a small addition, not a rework).

## 2. Dependencies

```
npm install jsonwebtoken cookie-parser
```

(`bcryptjs` is already installed from step 1.)

## 3. Files to create

### `server/middleware/auth.js`

- A dev-only constant `JWT_SECRET` (no env/config infra exists in this project yet, so hardcode it here — same pattern as `PORT`/`CLIENT_ORIGIN` constants already in `server/index.js`).
- `signToken(user)` — `jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })`.
- `requireAuth(req, res, next)` — reads `req.cookies.chirp_session`; missing or invalid/expired → `res.status(401).json({ success: false, error: 'Not authenticated.' })`; otherwise decodes the payload, sets `req.user = { id: payload.sub, username: payload.username }`, calls `next()`. This is what makes `GET /api/auth/me` fail safely (401 JSON) instead of throwing, and is reusable for any future protected API route.
- Cookie name: `chirp_session`.

## 4. Files to change

### `server/index.js`

- `import cookieParser from 'cookie-parser'` and `import { signToken, requireAuth } from './middleware/auth.js'`.
- `app.use(cookieParser())`.
- CORS middleware: add `res.header('Access-Control-Allow-Credentials', 'true')` alongside the existing origin/methods/headers lines.
- `POST /api/auth/login`:
  - `400` if `username`/`password` missing (same shape as register's validation failure).
  - Lowercase the username, `SELECT id, username, password_hash FROM users WHERE username = ?`.
  - If no row, or `bcrypt.compare(password, row.password_hash)` is false → `401 { success: false, error: 'Invalid username or password credentials.' }`. Same generic message either way — never reveal which field was wrong (spec rule).
  - On success: `signToken(user)`, `res.cookie('chirp_session', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 })`, then `res.json({ success: true, user: { id, username } })`.
- `POST /api/auth/logout`: `res.clearCookie('chirp_session')`, `res.json({ success: true })`. No auth check needed — logging out an already-logged-out client is a no-op, not an error.
- `GET /api/auth/me`: mount `requireAuth` as middleware, handler just returns `res.json({ success: true, user: req.user })`.

### `src/lib/auth.js`

- Delete: `USERS_KEY`, `SESSION_KEY`, `loadUsers`, `saveUsers`, `seedDefaultUser`, the old synchronous `loginUser`, `getSession`, `clearSession`. (`chirp.theme` is untouched — it lives in `ThemeContext.jsx`, not this file, and stays in `localStorage` per the spec's explicit rule.)
- Add:
  - `async function loginUser({ username, password })` — `fetch(`${API_BASE}/api/auth/login`, { method: 'POST', headers: {...}, credentials: 'include', body: JSON.stringify({ username, password }) })`. Network failure → `{ ok: false, error: 'Could not reach the server. Please try again.' }` (mirrors `registerUser`'s existing catch). On response: `!data.success` → `{ ok: false, error: data.error }`; else `{ ok: true, user: data.user }`.
  - `async function fetchSession()` — `GET /api/auth/me` with `credentials: 'include'`; returns `data.user` on 200, `null` on 401 or network failure (wrapped in try/catch — this must never throw, since `AuthContext` calls it unconditionally on every app load).
  - `async function logoutUser()` — `POST /api/auth/logout` with `credentials: 'include'`; swallow network errors (logout should always clear local state even if the request fails).
- `registerUser` is unchanged.

### `src/context/AuthContext.jsx`

- Remove the `seedDefaultUser` import and its module-level call.
- `const [user, setUser] = useState(null)`, `const [ready, setReady] = useState(false)`.
- `useEffect(() => { fetchSession().then(setUser).finally(() => setReady(true)) }, [])` — revalidates the session against the server on every mount/refresh, per spec section 10 ("quiet background verification call to `GET /api/auth/me`").
- `login` becomes `async function login(credentials) { const result = await loginUser(credentials); if (result.ok) setUser(result.user); return result }`.
- `logout` becomes `async function logout() { await logoutUser(); setUser(null) }` — clear local state unconditionally after the call settles (since `logoutUser` never throws).
- `register` unchanged.

### `src/pages/Login.jsx`

- `handleSubmit` becomes `async`, `await login({ username, password })` before branching on `result.ok` — same shape as `Register.jsx`'s existing `handleSubmit`.

### `src/pages/Home.jsx`

- `handleLogout` becomes `async function handleLogout() { await logout(); navigate('/login', { replace: true }) }`.

### Not changed

- `src/components/ProtectedRoute.jsx` — already branches on `ready`/`user` correctly; it was just inert before because `ready` was hardcoded `true`. No code change needed, but its behavior changes meaningfully (it'll now render `null` briefly on refresh while the `/api/auth/me` call is in flight).
- `src/pages/Landing.jsx`, `src/pages/Register.jsx` — already use the `ready && user` guard pattern; benefits automatically from `ready` becoming real.

## 5. Manual verification checklist

1. `npm run server` (port 5000) and `npm run dev` (port 5173) both running.
2. Log in with `mahesh` / `mahesh` → redirects to `/home`; a `chirp_session` httpOnly cookie is set (check DevTools → Application → Cookies, not `localStorage`).
3. Log in with a wrong password → generic "Invalid username or password credentials." error, no field-specific hint.
4. Refresh `/home` → stays logged in (no flash redirect to `/login`); Network tab shows a `GET /api/auth/me` call.
5. Open `/home` in a fresh incognito window with no cookie → redirected to `/login`.
6. Click logout on `/home` → redirected to `/login`; cookie is cleared; manually navigating back to `/home` redirects to `/login` again.
7. `curl -i http://localhost:5000/api/auth/me` with no cookie → `401` JSON, not a stack trace.

## 6. Open assumption to flag to the user

The JWT secret is a hardcoded string in `server/middleware/auth.js` since the project has no `.env`/config layer at all yet. This matches the project's current "no backend config infra" reality but is worth a callout — if real secrets management gets added later, this is the constant to move.
