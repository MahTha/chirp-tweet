# Spec: Remove Negative Sentiment Tweets

## Overview
Tweets whose sentiment is negative must not survive in the database. Step 8 added a nullable `sentiment` column (`true` = positive, `false` = negative, `null` = sentiment service unreachable/unknown) but stored every tweet regardless of the result. This step changes `POST /api/tweets` to **insert the tweet as normal, then immediately delete that same row if the sentiment result is `false`** — save first, then take it down based on the analysis result — rather than checking sentiment before the insert. This mirrors the moderation pattern the sentiment endpoint is meant to generalize to later (images, audio, other object types: save the object, run it through the same `/api/sentiment` contract, remove it if the result is negative), rather than baking tweet-specific pre-checks into that shared flow. `true` and `null` (service down/unknown) continue to be posted exactly as before — only an explicit `false` triggers the insert-then-delete. It also adds a one-time startup cleanup that deletes any negative-sentiment rows already sitting in `chirp.db` from before this rule existed. The home dashboard (feed, summary stats, author breakdown) needs no new UI: it already re-reads from the database after every post, and by the time that re-read happens the deleted row is already gone. The one visible UI change is that a rejected post surfaces a specific, human-readable reason in the composer's existing error area instead of appearing in the feed.

## Depends on
- Step 1 — Database setup (`01-database-setup.md`: `tweets` table layout).
- Step 7 — Post Tweet (`07-post-tweet.md`: `POST /api/tweets` endpoint).
- Step 8 — Tweet Sentiment Flag (`08-tweet-sentiment-flag.md`: `sentiment` column, `fetchSentiment()`, `normalizeSentiment()` — this step extends all three).

## Routes
No new routes. `POST /api/tweets` (existing, `server/app.js`) changes behavior:
- Insert always happens first, same as today (sentiment is already computed before the insert so it can be stored on the row).
- `sentiment === false` → immediately after the insert, delete that same row by its id (same request, same handler, before responding), then respond `422` with `{ success: false, error: 'This tweet was flagged as negative and has been removed.' }`. The row exists only transiently inside the request — no client ever observes it via `GET /api/tweets`.
- `sentiment === true` or `sentiment === null` → unchanged: row stays inserted, respond `201` as today.

`GET /api/tweets` and `GET /api/dashboard/summary` are unchanged code-wise — their existing queries automatically exclude negative tweets once those rows are deleted before any read can observe them.

## Database changes
- No new columns (the `sentiment` column already exists from Step 8).
- Add an idempotent startup cleanup in `initDb()`: `DELETE FROM tweets WHERE sentiment = 0;`, run once per startup after `ensureSentimentColumn()`. This purges any negative-sentiment rows persisted before this rule existed (e.g. from Step 8's initial rollout) from both a fresh test database (no-op, nothing to delete) and the real `chirp.db`. Safe to re-run — deletes zero rows once the table is already clean.

## Templates (Frontend)
No template changes. `src/pages/Home.jsx`'s composer already renders `postError` (from `postTweet()`'s `data.error`) regardless of HTTP status code, so the new `422` rejection message flows into the existing error paragraph with no code changes. The feed list, summary stats, and author breakdown already re-fetch from `GET /api/tweets` / `GET /api/dashboard/summary` after every post and after every filter change — since negative tweets can no longer be inserted, those existing reads simply never include them. This is the "reflection" in the dashboard: no separate negative-tweet indicator or banner is introduced, consistent with not adding UI beyond what the data change already implies.

## Files to change
- `server/db.js` — Add a `removeNegativeSentimentTweets(conn)` helper (same connection-agnostic shape as `ensureSentimentColumn`) and call it from `initDb()` right after `ensureSentimentColumn(db)`. This is the startup cleanup for rows persisted before this rule existed — a separate concern from the per-request delete below.
- `server/app.js` — In the `POST /api/tweets` handler, after the existing `INSERT` (and its follow-up `SELECT` of the new row) runs exactly as it does today: if `sentiment === false`, run `DELETE FROM tweets WHERE id = ?;` with that row's id, then respond `422` with the rejection message instead of `201`. The `true`/`null` path is unchanged — no delete, respond `201` as today.
- `server/db.test.js` — Add a test for `removeNegativeSentimentTweets`: seed a disposable table with rows at `sentiment = 1`, `0`, and `NULL`, run the helper, assert only the `sentiment = 0` row was deleted, and call it a second time to confirm idempotency (no error, no further deletions).
- `server/app.test.js` — Add a test that points `SENTIMENT_API_URL` at a throwaway local HTTP server returning `{ sentiment: false }` (same pattern `server/sentiment.test.js` already uses), posts a tweet, and asserts: response status `422`, `success: false`, a non-empty `error`, and that a subsequent `GET /api/tweets` does not include that tweet (confirming the insert-then-delete left no trace). Restore the original `SENTIMENT_API_URL` env value in `t.after(...)`.

## Files to create
None.

## New dependencies
No new dependencies.

## Rules for implementation
- Parameterized queries only — no string interpolation into SQL, matching the rest of `server/db.js` and `server/app.js`. The per-request `DELETE FROM tweets WHERE id = ?;` uses the same parameterized pattern as the existing `SELECT ... WHERE id = ?;` right above it.
- Only an explicit `sentiment === false` triggers the delete. A `null` result (sentiment service down, timed out, or replied with something malformed) must still post successfully and stay inserted, per Step 8's existing fallback contract — don't conflate "unknown" with "negative."
- The insert-then-delete happens synchronously within the same request handler, before the response is sent — there is no window where a client's `GET /api/tweets` could observe the row, and no background job or queue is introduced.
- Keep the sentiment call/response contract (`fetchSentiment`, `{ tweet, sentiment }`) exactly as Step 8 defined it — this step only changes what `server/app.js` does with a `false` result, not the shape of the request to or response from the sentiment service, since that contract is meant to stay generic for future non-tweet content.
- Routes stay wrapped in the existing `asyncHandler` → single error-middleware convention; rejecting a negative tweet is an expected `422` response, not a thrown error.
- The startup cleanup (`removeNegativeSentimentTweets`) must be idempotent — re-running `initDb()` against an already-clean database must not error or misbehave. It is a one-time backfill for rows written before this rule existed and is independent of the new per-request delete.
- Test suite must not depend on the real `sentiment/` service running; the negative path is tested the same way `server/sentiment.test.js` tests failure modes — via a throwaway local HTTP server, not the actual `sentiment/index.js` process.
- Don't add new frontend components, banners, or indicators for this — the existing composer error display and existing data re-fetches are sufficient, per the "Templates" section above.

## Definition of done
- [ ] Posting a tweet that the sentiment service scores `false` is inserted and then immediately deleted within the same request; the response is `422` with a clear `error` message, and the tweet does not appear in any subsequent `GET /api/tweets`.
- [ ] Posting a tweet that scores `true`, or `null` (service down/unreachable/malformed), still returns `201`, stays inserted, and is unchanged from Step 8.
- [ ] On server startup, any pre-existing rows in `chirp.db` with `sentiment = 0` are deleted; rows with `sentiment = 1` or `NULL` are untouched.
- [ ] Re-running the startup cleanup against an already-clean database does not error and deletes nothing further.
- [ ] `GET /api/tweets` and `GET /api/dashboard/summary` never include a negative-sentiment tweet, with no code changes to either route.
- [ ] The Home dashboard composer shows the rejection message (via the existing `postError` UI) when a tweet is rejected, with no new frontend components.
- [ ] `npm test` passes without the `sentiment/` service running.
