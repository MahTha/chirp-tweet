# Spec: Tweet Sentiment Flag

## Overview
Adds a `sentiment` flag to each tweet. When a tweet is posted, the backend calls the external sentiment-analysis service already scaffolded in `sentiment/index.js` (`POST http://localhost:3001/api/sentiment`, body `{ "tweet": "<content>" }`, response `{ "tweet": "<content>", "sentiment": true|false }`) and persists the returned boolean alongside the new tweet row. If the sentiment service is unreachable, times out, or replies with something unexpected, tweet creation must still succeed — `sentiment` is stored and returned as `null` in that case rather than failing the request.

## Depends on
- Step 1 — Database setup (`01-database-setup.md`: `tweets` table layout).
- Step 7 — Post Tweet (`07-post-tweet.md`: `POST /api/tweets` endpoint this step extends).

## Routes
No new routes. `POST /api/tweets` and `GET /api/tweets` (both existing, defined in `server/app.js`) change their behavior/payload shape; no new endpoints are added on the Chirp backend. The `sentiment/index.js` service and its `POST /api/sentiment` route already exist as a separate process and are only called server-to-server — they are not proxied or exposed to the frontend.

## Database changes
- Add a nullable `sentiment` column to the `tweets` table: `sentiment INTEGER` (SQLite has no native boolean type; store `0`/`1`/`NULL`, normalize to JS `true`/`false`/`null` at the API boundary — never leak raw `0`/`1` in JSON responses).
- `chirp.db` already exists with a `tweets` table from Step 1, so the existing `CREATE TABLE IF NOT EXISTS` statement in `server/db.js` will not add the column to that pre-existing table. `initDb()` needs an idempotent migration step (e.g. `PRAGMA table_info(tweets)` check, then `ALTER TABLE tweets ADD COLUMN sentiment INTEGER;` only if the column is missing) so both the fresh test database and the pre-existing `chirp.db` end up with the column.

## Templates (Frontend)
No template changes. This step is backend/database-only, per the request — the `sentiment` field will be present in API responses for future use but nothing in `src/` renders or consumes it yet.

## Files to change
- `server/db.js` — Add `sentiment INTEGER` to `CREATE_TWEETS_TABLE`; add the `PRAGMA table_info` migration check inside `initDb()` for pre-existing databases.
- `server/app.js` — In the `POST /api/tweets` handler, call the new sentiment helper with the trimmed content before inserting, include the (possibly `null`) result in the `INSERT`, and normalize `0`/`1`/`NULL` to `true`/`false`/`null` in both the create response and the `GET /api/tweets` `SELECT` mapping.
- `.env.example` — Document `SENTIMENT_API_URL` with its default value and a comment explaining it points at the separate `sentiment/` service.
- `server/app.test.js` — Extend the existing "tweets require auth to read or post, and round-trip correctly" test (or add a new one) to assert every tweet object includes a `sentiment` field whose value is `true`, `false`, or `null` — never `0`/`1`/`undefined`. Since the real `sentiment/` service won't be running during `npm test`, this doubles as the assertion that a missing service degrades to `null` instead of failing the request.

## Files to create
- `server/sentiment.js` — Exports `fetchSentiment(tweetContent)`: `POST`s `{ tweet: tweetContent }` to `process.env.SENTIMENT_API_URL` (default `http://localhost:3001/api/sentiment`) using the built-in global `fetch`, with a short timeout (e.g. 3s via `AbortController`). Returns the response's `sentiment` boolean on a well-formed `200`, or `null` on any network error, timeout, non-200 status, or malformed/missing `sentiment` field in the body. Never throws.
- `server/sentiment.test.js` — Unit tests for `fetchSentiment`: spins up a throwaway local HTTP server (same pattern `app.test.js` uses for the Express app) to stand in for `sentiment/index.js`, covering: a happy-path `200` with `sentiment: true`/`false`, a non-200 response, a malformed JSON body, and an unreachable port — asserting `null` is returned (never a thrown error) in every failure case.

## New dependencies
No new dependencies. Uses Node's built-in global `fetch` and `AbortController`, already implicitly relied upon elsewhere in this codebase's Node runtime.

## Rules for implementation
- Parameterized queries only — no string interpolation into SQL, matching the rest of `server/db.js`.
- Routes stay wrapped in the existing `asyncHandler` → single error-middleware convention; `fetchSentiment` must catch its own failures internally so a down sentiment service never bubbles into that error middleware as a `500`.
- Trim content the same way the existing `POST /api/tweets` validation already does before sending it to the sentiment service.
- Never store or return sentiment as a raw SQLite `0`/`1` integer — always normalize to boolean or `null` at the point of API response.
- The migration for existing rows/databases must be idempotent — re-running `initDb()` against a database that already has the `sentiment` column must not error.
- Test suite must not depend on the `sentiment/` service actually running; behavior when it's absent (the default in CI/local test runs) is the `null`-fallback path, not a failure.

## Definition of done
- [ ] `tweets` has a nullable `sentiment` column on both a brand-new database and the pre-existing `chirp.db`.
- [ ] Posting a tweet calls `POST http://localhost:3001/api/sentiment` with `{ "tweet": "<trimmed content>" }` and persists the returned boolean when the service responds normally.
- [ ] With the `sentiment/` service not running, posting a tweet still returns `201 Created` and the tweet's `sentiment` is `null`.
- [ ] Both `POST /api/tweets`'s response and every row from `GET /api/tweets` include `sentiment` as `true`, `false`, or `null` — never `0`, `1`, or missing.
- [ ] `.env.example` documents `SENTIMENT_API_URL` with its default.
- [ ] `npm test` passes without the `sentiment/` service running.
