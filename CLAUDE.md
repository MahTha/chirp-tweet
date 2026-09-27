# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev           # start the Vite dev server (frontend, http://localhost:5173)
npm run server        # start the Express API server (backend, http://localhost:5000)
npm run build         # production build to dist/
npm run preview       # preview the production build
npm run lint          # oxlint
npm run format        # prettier --write .
npm run format:check  # prettier --check .
```

Both `npm run dev` and `npm run server` must be running simultaneously for the app to work — the frontend is a pure API client with no dev-server proxy; it calls the backend directly via absolute URLs (`API_BASE = 'http://localhost:5000'` in `src/lib/auth.js` and `src/lib/dashboard.js`).

There is no test suite (frontend or backend) — it was removed. If you add one back, be aware Node's built-in test runner will treat any `.js` file under a directory as fair game, not just `*.test.js`, so pointing it at the whole `server/` directory would actually execute `server/index.js`'s `main()` (a real listening server); name test files explicitly in the `test` script instead.

**Environment variables:** the backend reads `JWT_SECRET` and `CLIENT_ORIGIN` from `.env` (loaded via `server/env.js`, using Node's built-in `process.loadEnvFile` — no `dotenv` dependency). Copy `.env.example` to `.env` for local dev. If `.env` is missing or `JWT_SECRET` isn't set, the server falls back to an insecure dev secret and logs a warning once — fine for local hacking, never for anything deployed. If Vite starts on a port other than `5173` (it auto-increments when busy), update `CLIENT_ORIGIN` in `.env` to match or every frontend fetch will fail as a CORS error even though both servers are up.

## Project overview

Chirp ("fakeTweet") is a Twitter/X clone: React 19 + Vite frontend, Express 5 + SQLite backend. It started as a frontend-only prototype (fake localStorage auth, in-memory tweets) and was migrated to a real backend feature-by-feature; `.claude/specs/` and `.claude/plans/` contain the original spec/plan pairs for each migration step (database setup → registration → login/logout → profile → tweet feed/dashboard → tweet filters → posting) and are useful history if behavior in one of those areas seems under-specified.

## Architecture

**Backend (`server/`)**
`server/app.js` exports `createApp()`, which builds and returns the Express app (no router modules — all routes live in this one file) with all middleware: `morgan('dev')` request logging (silenced when `NODE_ENV=test`), the manual CORS header block, and an `express-rate-limit` limiter (10 req/15min) applied to `/api/auth/login` and `/api/auth/register`. Routes are wrapped in a local `asyncHandler` and forward errors to a single error-handling middleware at the bottom of `createApp()` — routes don't each do their own `try/catch` → 500. `server/index.js` is the thin entry point: it runs `initDb()`, calls `createApp()`, and starts listening — this split (app construction vs. process startup) is what makes the app importable and testable without binding a real port. `server/db.js` owns the raw `sqlite3` connection (promisified via `promisify` — no ORM, parameterized queries only) against `chirp.db` in the project root (overridable via `DB_PATH` env var), plus `initDb()` (creates tables if missing). `server/middleware/auth.js` issues/verifies the JWT stored in the `chirp_session` httpOnly cookie (`requireAuth` middleware populates `req.user`). Usernames are always lowercased before hitting the database, in both routes and `db.js`. `GET /api/tweets` paginates via `limit`/`offset` query params (default limit 50, max 100) and returns `hasMore` — the frontend doesn't currently send these params or expose "load more" UI, so it always sees the newest page.

**Auth (`src/lib/auth.js` + `src/context/AuthContext.jsx`)**
All requests go through `fetch(..., { credentials: 'include' })` so the browser sends/receives the `chirp_session` cookie; there is no client-side token handling. `AuthContext` calls `fetchSession()` (`GET /api/auth/me`) once on mount to restore the session and exposes `login`/`register`/`logout`/`updateUsername` plus the current `user` via `useAuth()`. `src/components/ProtectedRoute.jsx` gates `/home` and `/profile` on `user` being present once `ready` is true, redirecting to `/login` otherwise.

**Tweets & dashboard (`src/lib/dashboard.js`)**
Tweets and the summary stats/author breakdown shown in `Home.jsx` are fetched live from `GET /api/tweets` (supports `scope=mine` and `search=` query params, both applied server-side via SQL `WHERE`/`LIKE`) and `GET /api/dashboard/summary`. Posting via the composer does a real `POST /api/tweets`, then the page re-fetches both the tweet list and the dashboard summary — nothing is optimistically inserted client-side.

**Theming (`src/context/ThemeContext.jsx` + `src/index.css`)**
Light/dark mode is the one remaining piece of client-only state: a `data-theme` attribute on `<html>`, persisted in `localStorage` (`chirp.theme`). All color values are CSS custom properties defined once on `:root` in `src/index.css` (e.g. `--chirp-bg`, `--chirp-border`, `--chirp-card-bg`, `--chirp-hover`, `--chirp-page-gradient`) and re-defined under `[data-theme='dark']`. Every component/page CSS file consumes these variables rather than hardcoding colors — when adding new UI, follow that pattern so it stays theme-correct in both modes. `ThemeToggle` (rendered once, globally, in `App.jsx`) is a fixed floating button in the bottom-right corner on every page.

**Routing (`src/App.jsx`)**
Public pages (Landing, Login, Register, legal pages, company pages) are nested under one layout `<Route element={<PublicLayout />}>`, which renders `Navbar` + `<Outlet />` + `Footer` — add new public pages as children of that route rather than wrapping each one individually. `/home` and `/profile` are separate top-level routes wrapped in `ProtectedRoute` and do **not** use `PublicLayout` — `/home` has its own sidebar-based chrome instead of a navbar/footer, matching the real Twitter/X app shell.

**Page groups under `src/pages/`**
- `legal/` — Terms of Service, Privacy Policy, Cookie Policy
- `company/` — About, Help Center, Accessibility, Ads Info, Careers, Brand Resources, Developers
- Both groups share the same `src/components/ContentPage.jsx` layout (title + optional subtitle + body) for visual consistency; add new static content pages the same way rather than one-off layouts.
