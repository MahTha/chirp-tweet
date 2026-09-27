# Implementation Plan: 04-profile.md

Source spec: `.claude/specs/04-profile.md`

## 0. Discrepancy note (read first)

`CLAUDE.md` describes Chirp as "frontend-only" with `localStorage`-simulated auth in
`src/lib/auth.js`. That is stale — steps 1–3 already replaced it with a real backend:
Express + SQLite (`server/`), JWT session cookies (`server/middleware/auth.js`), and
`src/lib/auth.js` now does `fetch()` calls against `http://localhost:5000`. This plan
follows the **current code** (real backend), not the outdated `CLAUDE.md` description.
No `Profile.jsx`, `/profile` route, or `/api/users/*` endpoints exist yet.

## 1. Key existing-code facts that shape this plan

- `server/index.js` defines all routes inline (no controllers/router files) — new routes
  should follow that same pattern, not introduce a new file structure.
- `server/middleware/auth.js` → `requireAuth` decodes the JWT **cookie** and sets
  `req.user = { id, username }` straight from the token payload — it does **not** hit the
  DB. This matters: if a user changes their username, their existing cookie still carries
  the *old* username until a new token is issued. The profile-update endpoint must
  re-sign and re-set the session cookie (same as login does), or the user's session goes
  stale immediately after a successful rename.
- The CORS middleware in `server/index.js` only allows `GET, POST, OPTIONS`. `PUT` must
  be added or the browser will fail preflight on both new mutating endpoints.
- `src/context/AuthContext.jsx` `user` state is currently only ever set from
  `login`/`fetchSession`, both of which return `{ id, username }`. There's no setter a
  page can call after an unrelated mutation — one needs to be added so the profile page
  can push a renamed username into global state without forcing a refetch.
- `src/pages/Home.jsx` already has an inert **Profile** entry in its sidebar `NAV_ITEMS`
  (icon + label, no `onClick`, no route). Wiring it to navigate to the new page is in
  scope, per spec §10's "global navigation" expectation — but only in the sense of
  routing there; NAV_ITEMS' `active` highlighting is currently hardcoded to `Home` and
  reworking that into route-aware highlighting for all five nav items is out of scope
  (unrelated existing shortcoming, not part of this spec).
- Pre-existing, unrelated bug worth flagging but **not fixing here**: `Home.jsx` and
  `src/lib/tweets.js` read `user.name` / `user.handle`, fields that don't exist on the
  real `user` object (`{ id, username }`). That's orthogonal to this spec (which only
  needs `user.username` to update live) — out of scope, don't fix opportunistically.
- No router/controller layering exists for `/api/auth/*` — so the new `/api/users/*`
  routes are added directly in `server/index.js` next to the auth routes, matching
  existing convention.

## 2. Backend plan (`server/index.js`)

### 2.1 CORS
Add `PUT` to `Access-Control-Allow-Methods`.

### 2.2 `GET /api/users/profile` (behind `requireAuth`)
- Look up the fresh row by `req.user.id` (don't trust the token payload for anything
  beyond identity — `created_at` isn't in the token at all, and username may have gone
  stale between requests within the same 7-day cookie lifetime if changed from another
  tab/session).
- Query: `SELECT id, username, created_at FROM users WHERE id = ?;`
- 200 → `{ success: true, profile: { id, username, created_at } }`
- If somehow no row (deleted user, stale token) → 401, same shape as other auth failures.

### 2.3 `PUT /api/users/profile` (behind `requireAuth`)
Body: `{ username }`.

Order of checks:
1. Presence: `username?.trim()` non-empty → else 400.
2. Normalize: `const key = username.trim().toLowerCase()` (spec's "Lowercase Rules").
3. Uniqueness, excluding self:
   `SELECT id FROM users WHERE username = ? AND id != ?;` with `[key, req.user.id]`
   → if a row comes back, 409 Conflict.
4. `UPDATE users SET username = ? WHERE id = ?;` with `[key, req.user.id]`.
5. **Re-issue the session cookie** — `signToken({ id: req.user.id, username: key })` and
   `res.cookie(SESSION_COOKIE, ...)` with the same options login uses — so
   `requireAuth` on subsequent requests reflects the new username immediately.
6. 200 → `{ success: true, profile: { id: req.user.id, username: key } }`.

Re-submitting the unchanged current username: step 3's `id != ?` exclusion means it
matches zero rows, so it falls through to a no-op-equivalent update and 200 — matches
spec's explicit DoD item.

### 2.4 `PUT /api/users/password` (behind `requireAuth`)
Body: `{ currentPassword, newPassword }`.

Exact order per spec §9 (deliberately compare-before-length, not the more obvious
length-first):
1. Presence: both fields non-empty strings → else 400.
2. Load `password_hash` for `req.user.id`; `bcrypt.compare(currentPassword, hash)` → if
   false, 401 (spec's status table lists 401 here, not 400 — wrong *current* password is
   an auth failure, not a malformed request).
3. Length: `newPassword.length >= 8` → else 400.
4. Hash new password (`bcrypt.hash(newPassword, 10)`), `UPDATE users SET password_hash = ?
   WHERE id = ?;`.
5. 200 → `{ success: true }`. No need to reissue the session cookie here (identity/
   username unchanged) — but per spec DoD "invalidates older credentials immediately,"
   double check: that DoD line just means the *old password* stops working for future
   logins, which the hash swap already guarantees. Existing active sessions/cookies stay
   valid (expected — this isn't a "log out other devices" feature, and spec doesn't ask
   for one).

## 3. Frontend plan

### 3.1 `src/lib/auth.js` — add three functions, same shape as existing ones
(`credentials: 'include'`, try/catch → `{ ok: false, error: 'Could not reach the
server...' }` on network failure, else parse JSON and branch on `data.success`):

- `fetchProfile()` → `GET /api/users/profile` → `{ ok, profile }` or `{ ok, error }`.
- `updateProfile({ username })` → `PUT /api/users/profile` → `{ ok, profile }` / `{ ok,
  error }`.
- `changePassword({ currentPassword, newPassword })` → `PUT /api/users/password` → `{ ok
  }` / `{ ok, error }`.

### 3.2 `src/context/AuthContext.jsx`
Add an `updateUsername(username)` (or generic `setUser` passthrough) exposed from the
provider so `Profile.jsx` can merge the server's confirmed new username into `user`
right after a successful `PUT /api/users/profile`, without a full page refresh — this is
what makes the sidebar/global nav update "instantly" per spec §10.

```js
function updateUsername(username) {
  setUser((prev) => (prev ? { ...prev, username } : prev))
}
```
Expose it in the context value alongside `login`/`register`/`logout`.

### 3.3 Routing — new top-level route vs. overlay
Spec §3B allows either "`/profile` (or a structural settings overlay within `/home`)".
Recommendation: **new top-level route**, consistent with how `/home` is already handled
(its own `ProtectedRoute`-wrapped route, no shared `PublicLayout`). An overlay/modal
system doesn't exist anywhere in the app yet, and building one is disproportionate to
this spec's scope. Concretely:

- `src/App.jsx`: import `Profile`, add
  ```jsx
  <Route
    path="/profile"
    element={
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    }
  />
  ```
  next to the `/home` route.
- `src/pages/Home.jsx`: give the `Profile` entry in `NAV_ITEMS` an `onClick` that calls
  `navigate('/profile')` (the other three inert items — Explore, Notifications,
  Messages — stay as-is; wiring them isn't part of this spec).

### 3.4 `src/pages/Profile.jsx` (new)
Two visually-separate forms, each with **independent** `error`/`success`/`loading`
state (spec §9 "Independent State Scoping") so a password-form error can't stomp a
just-shown username-saved message or vice versa.

- On mount: `fetchProfile()` to populate `username` (and show `created_at`, e.g. "Joined
  <date>") — avoids showing stale/placeholder data (spec §10).
- **Username form**: single text input, pre-filled, "Save" button. On submit →
  `updateProfile({ username })`. On success: call `updateUsername()` from context, set a
  local success message, update the input's baseline. On 409 → show "That username is
  already taken." (or the server's `error` string). On 400 → show server's message.
- **Password form**: current password, new password, confirm-new-password (confirm is a
  client-only check, not sent to the server — mirrors `Register.jsx`'s existing
  password/confirm pattern). On submit: if new !== confirm → local error, don't call the
  API. Else → `changePassword(...)`. On 401 (wrong current password) → "Current password
  is incorrect." On 400 (too short) → "New password must be at least 8 characters."
  On success → clear all three fields, show a success message, don't touch the username
  form's state.
- Reuse existing visual language rather than `ContentPage` (that's for static public
  marketing pages) — style close to `Auth.css`'s card/form look, adapted for the
  authenticated shell. New `src/pages/Profile.css` following the project's theming rule:
  consume `--chirp-*` custom properties only, no hardcoded colors, so it's correct in
  both light and dark mode automatically.
- Include a link/back-button to `/home`.

## 4. Files touched (superset of spec §6, with the CORS fix added)

**Backend**
- `server/index.js` — CORS methods list (+`PUT`), 3 new routes.

**Frontend**
- `src/lib/auth.js` — `fetchProfile`, `updateProfile`, `changePassword`.
- `src/context/AuthContext.jsx` — `updateUsername`.
- `src/App.jsx` — `/profile` route.
- `src/pages/Home.jsx` — wire Profile nav item's `onClick`.
- `src/pages/Profile.jsx` (new).
- `src/pages/Profile.css` (new).

No database migration needed — `users.created_at` already exists from step 1.

## 5. Manual verification checklist (for you to run after implementation — per your
standing note, I won't self-test; you drive this)

1. `npm run server` + `npm run dev`, log in as `mahesh` / `mahesh`.
2. Visit `/profile` directly and via the sidebar Profile button — confirm it shows the
   real username and a join date, not placeholders.
3. Rename to an unused username → success message, sidebar/nav updates without a
   refresh, reload the page → new username persists (re-fetched from `/api/users/profile`).
4. Re-submit the *same* username unchanged → should succeed (not 409).
5. Try renaming to `mahesh` from a second seeded/registered account → 409, clear error,
   password form untouched.
6. Log out (clear cookie) and `curl`/fetch `/api/users/profile` and `PUT
   /api/users/password` directly → both 401.
7. Password change: wrong current password → error, nothing changes. New password < 8
   chars → error. Mismatched confirm on the frontend → blocked client-side, no request
   sent. Valid change → success message; log out and log back in with the *new*
   password (old one should now fail).
8. Trigger a username-conflict error, then immediately submit a valid password change (or
   vice versa) → confirm the two forms' messages don't clobber each other.

## 6. Definition of Done (mirrors spec §11)

- [ ] Unauthenticated `GET/PUT /api/users/profile` and `PUT /api/users/password` → 401.
- [ ] Valid username change persists to DB and updates the session cookie/token.
- [ ] Renaming to another user's existing username → 409, current user's own row
      unaffected.
- [ ] `newPassword` under 8 chars → rejected with 400.
- [ ] Successful password change: old password fails on next login, new password
      succeeds.
