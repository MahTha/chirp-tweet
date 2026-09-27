# Implementation Plan: 05-tweet-feed-dashboard.md

Source spec: `.claude/specs/05-tweet-feed-dashboard.md`

## 0. Discrepancy notes (read first)

- The spec's §1 says this replaces `useState(SEED_TWEETS)` in `Home.jsx`. That's stale —
  the actual current tweet source is `src/lib/tweets.js`, a full localStorage-backed
  fake store (seed, add, like, retweet) invoked from `Home.jsx` via
  `seedDefaultTweets()` (a module-load side effect) and `useState(() => getTweets())`.
  This plan targets that real code, not the spec's stale description — same situation
  `.claude/plan/04-profile.md` already flagged for auth.
- The `users` table (`server/db.js`) only has `id`, `username`, `password_hash`,
  `created_at` — no `name`/`handle` columns. `Home.jsx` currently renders
  `tweet.name` / `tweet.handle`, fields that only ever existed in the fake
  `tweets.js` seed data. The 04-profile plan flagged this as a pre-existing bug and
  left it alone because it was out of scope there. Here it's **in scope**, because
  this spec's SQL (§4) only ever selects `users.username` — there is no display name
  to join against. Decision: **use `username` for both the bold name and the `@handle`**
  in tweet rows and the author breakdown. No schema change — out of scope to add a
  `display_name` column for this spec.

## 1. Scope decision: composer, likes, retweets are cut, not carried over

The spec's routes/payloads (§3, §5) only cover two **read** endpoints. §1 explicitly
frames single-tweet create/edit/delete as *"a prerequisite for... future scopes"* —
i.e. not this one. But the current `Home.jsx` also has a working composer
(`handlePost` → `addTweet`) and like/retweet buttons (`toggleLike`/`toggleRetweet`),
all backed by `src/lib/tweets.js` localStorage.

None of that has a server counterpart yet (no `POST /api/tweets`, no likes/retweets
table). Leaving it wired up would mean fake, locally-invented tweets and like counts
silently mixed into what's supposed to be *"the complete historical feed index"* from
the database — directly contradicting DoD item 2. So:

- **Remove** the composer form, `draft` state, and `handlePost`.
- **Remove** the like/retweet buttons and their handlers (the DB schema has no
  `likedBy`/`retweetedBy` data to back them — tweets from the API won't have those
  arrays at all).
- **Delete `src/lib/tweets.js`** — fully superseded by the two new API calls; nothing
  else imports it.

If you'd rather keep the composer visible but disabled (e.g. a "coming soon" tooltip)
instead of removing it outright, say so — happy to adjust, but full removal is the
better default: a disabled-but-present form implies more was built than actually was.

## 2. Backend plan (`server/index.js`)

Both routes are `GET`-only, so no CORS change is needed (`GET` is already allowed).
Both go behind `requireAuth` (imported already), following the exact inline-route,
try/catch-then-500 convention every existing handler uses — no new router/controller
files.

### 2.1 `GET /api/dashboard/summary`

```js
app.get('/api/dashboard/summary', requireAuth, async (req, res) => {
  const db = getDb()
  try {
    const stats = await db.getAsync(
      'SELECT COUNT(*) as total_tweets, COUNT(DISTINCT user_id) as total_authors FROM tweets;'
    )
    const breakdown = await db.allAsync(
      `SELECT users.username, COUNT(tweets.id) as tweet_count
       FROM tweets
       JOIN users ON tweets.user_id = users.id
       GROUP BY users.username
       ORDER BY tweet_count DESC;`
    )
    res.json({
      success: true,
      stats: { totalTweets: stats.total_tweets, totalAuthors: stats.total_authors },
      breakdown,
    })
  } catch (err) {
    console.error('Dashboard summary failed:', err)
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
})
```

- `COUNT(*)`/`COUNT(DISTINCT ...)` over zero rows still returns one row of zeros (never
  `null`, no empty result set) — spec §7's "graceful empty fallback" for `stats` is
  satisfied for free, no extra empty-check code needed.
- The `breakdown` `JOIN` genuinely returns `[]` on an empty table — fine, `.map()` on
  the frontend handles that naturally as long as the UI renders an empty-state card
  instead of an empty list (see §3.3).
- Field casing matches spec §5A exactly as given: `stats` keys are camelCase
  (`totalTweets`, `totalAuthors`), `breakdown` rows keep the raw SQL column names
  (`username`, `tweet_count`) — don't "normalize" the breakdown rows to camelCase,
  the spec's own example shows snake_case there.

### 2.2 `GET /api/tweets`

No example payload is given for this one (spec only shows §5A for the summary route),
so this plan defines the shape:

```js
app.get('/api/tweets', requireAuth, async (req, res) => {
  const db = getDb()
  try {
    const tweets = await db.allAsync(
      `SELECT tweets.id, tweets.content, tweets.created_at, users.username
       FROM tweets
       JOIN users ON tweets.user_id = users.id
       ORDER BY tweets.created_at DESC, tweets.id DESC;`
    )
    res.json({ success: true, tweets })
  } catch (err) {
    console.error('Fetching tweets failed:', err)
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
})
```

- Row shape: `{ id, content, created_at, username }` — snake_case `created_at` to
  match the breakdown route's own precedent of not renaming raw SQL columns.
- **Secondary sort `tweets.id DESC`**: `created_at` is `datetime('now')`, second-level
  resolution only. Two tweets posted in the same second — plausible in manual
  testing/demoing — would otherwise have no defined order. Ordering by `id` too
  makes descending-by-recency deterministic.

## 3. Frontend plan

### 3.1 New `src/lib/dashboard.js` (replaces `src/lib/tweets.js`)

Same shape as every function in `src/lib/auth.js` — `credentials: 'include'`, network
failure caught and turned into `{ ok: false, error: 'Could not reach the server. Please try again.' }`, else parse JSON and branch on `data.success`:

- `fetchTweets()` → `GET /api/tweets` → `{ ok: true, tweets }` / `{ ok: false, error }`.
- `fetchDashboardSummary()` → `GET /api/dashboard/summary` → `{ ok: true, stats, breakdown }` / `{ ok: false, error }`.
- `formatRelativeTime(createdAt)` — ported from the old `tweets.js`, but **fixed for
  the new input shape**. The old version took a numeric `Date.now()` epoch ms; the API
  now returns SQLite's `datetime('now')` string, e.g. `"2026-09-24 10:00:00"` — no
  timezone suffix. `new Date("2026-09-24 10:00:00")` is parsed as **local** time by
  most engines even though the value is UTC, which would skew every relative time by
  the viewer's UTC offset. Fix: parse as
  `new Date(createdAt.replace(' ', 'T') + 'Z')` before diffing against `Date.now()`.

### 3.2 `src/pages/Home.jsx`

- Drop the `seedDefaultTweets()` module-level call and the `src/lib/tweets.js` import
  entirely; import `fetchTweets`, `fetchDashboardSummary`, `formatRelativeTime` from
  the new `src/lib/dashboard.js` instead.
- Replace `useState(() => getTweets())` with:
  ```js
  const [tweets, setTweets] = useState([])
  const [stats, setStats] = useState({ totalTweets: 0, totalAuthors: 0 })
  const [breakdown, setBreakdown] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  ```
- `useEffect(() => { ... }, [])` on mount: fire `fetchTweets()` and
  `fetchDashboardSummary()` together (`Promise.all`), populate the state above, set
  `loading` false in a `finally`. If either call comes back `ok: false`, set `error`
  to its message (both endpoints are behind `requireAuth`; a stale/expired cookie
  mid-session is the realistic failure case here, not just the network drop `auth.js`
  already handles) — render that inline rather than crashing the page. No forced
  redirect to `/login` on a 401 here; `ProtectedRoute` already gates entry, and adding
  reactive logout-on-expiry is bigger than this spec asks for.
- Remove: `draft` state, `handlePost`, the `<form className="composer">` block,
  `handleLike`, `handleRetweet`, and the retweet/like `<button>`s inside the tweet
  list (see §1 for why).
- Tweet list rendering, per tweet row from the API (`{ id, content, created_at, username }`):
  ```jsx
  <Avatar name={tweet.username} />
  ...
  <strong>{tweet.username}</strong>
  <span className="tweet-handle">@{tweet.username}</span>
  <span className="tweet-dot">&middot;</span>
  <span className="tweet-time">{formatRelativeTime(tweet.created_at)}</span>
  ...
  <p className="tweet-content">{tweet.content}</p>
  ```
  (no actions row anymore — nothing left to act on).
- Empty/loading/error states for the feed list (DoD item 4 only requires the "No
  tweets yet" card, but loading/error need *some* non-broken state too):
  - `loading` → simple `<p className="home-feed-status">Loading tweets…</p>`.
  - `error` (and not loading) → `<p className="home-feed-status home-feed-error">{error}</p>`.
  - not loading, no error, `tweets.length === 0` → a `.home-card`-style block: *"No
    tweets yet"*.
  - otherwise → the existing `<ul className="tweet-list">` map, trimmed as above.

### 3.3 Right column: Summary Stats + Author Breakdown

`Home.css`'s `.home-right` (25% column, already holds `.home-card` blocks — see the
existing "What's happening" trends card) is the natural home for the two new pieces.
Plan: add two new `.home-card`s **above** the existing trends card, leave the trends
card as-is (it's pre-existing decorative content, unrelated to this spec — removing it
isn't asked for and would be scope creep).

- **Summary Stats card**: title + two stat rows, `stats.totalTweets` /
  `stats.totalAuthors`. Since `stats` always defaults to `{ totalTweets: 0,
  totalAuthors: 0 }` and the backend query guarantees zeros-not-null on an empty DB,
  no extra empty-state branch is needed here — it just renders `0`.
- **Author Breakdown card**: title + ranked list from `breakdown`
  (`{ username, tweet_count }[]`, already `ORDER BY tweet_count DESC` from SQL — no
  client-side sorting needed). If `breakdown.length === 0`, render a small "No
  authors yet" line instead of an empty list — same empty-database scenario as the
  main feed, just a second surface for it.
- Both cards should only render their real content once `!loading`; while loading,
  reuse the same `Loading…` treatment as the feed column so the three pieces (feed,
  stats, breakdown) don't visually settle at different times in a jarring way. Keep
  this simple — no skeleton loaders, just conditional text, consistent with the rest
  of the app's current level of polish.
- New `.home-stat-row`, `.home-breakdown-list` etc. class names go in the existing
  `Home.css` (no new CSS file) — consume `--chirp-*` custom properties only, per
  `CLAUDE.md`'s theming rule, same as every other rule in that file.

## 4. Files touched

**Backend**
- `server/index.js` — two new `GET` routes (§2.1, §2.2), both behind `requireAuth`.

**Frontend**
- `src/lib/dashboard.js` (new) — `fetchTweets`, `fetchDashboardSummary`,
  `formatRelativeTime`.
- `src/lib/tweets.js` — **deleted** (fully superseded, nothing else references it).
- `src/pages/Home.jsx` — swap local/localStorage tweet state for the two fetches;
  remove composer + like/retweet UI; add Summary Stats + Author Breakdown cards;
  add loading/error/empty handling.
- `src/pages/Home.css` — a handful of new classes for the two new cards and the
  loading/error/empty status lines.

No database migration — both queries run against the existing `tweets`/`users`
tables from step 1.

## 5. Manual verification checklist (for you to run after implementation — I won't
self-test, per your standing preference; you drive this)

1. `npm run server` + `npm run dev`, log in as `mahesh` / `mahesh`.
2. Fresh DB with zero tweets (delete `chirp.db`, restart the server to reseed just the
   user): visiting `/home` shows "No tweets yet", stats card shows `0` / `0`, author
   breakdown shows "No authors yet" — nothing throws, nothing shows `null`/`undefined`.
3. Insert a few tweets directly (or via a temporary `sqlite3 chirp.db "INSERT INTO
   tweets ..."` / a scratch script) across more than one seeded user: feed shows them
   newest-first, stats/breakdown numbers match, breakdown is sorted descending by
   count.
4. Two tweets inserted with the exact same `created_at` second: confirm feed order is
   still stable/deterministic across a page refresh (tests the `id DESC` tiebreak).
5. Log out (clear the cookie) and hit `GET /api/tweets` / `GET /api/dashboard/summary`
   directly (curl or browser devtools) → both `401`.
6. Confirm the composer and like/retweet buttons are gone from `/home`, and that
   `src/lib/tweets.js` has no remaining imports anywhere (`grep -r "lib/tweets"`).
7. Toggle dark mode via the existing `ThemeToggle` — confirm the two new cards use
   theme colors correctly (no hardcoded light-only colors).
8. Resize to ≤1000px width — confirm the right column (including the new cards) hides
   per the existing `.home-layout` breakpoint, same as the trends card does today.

## 6. Definition of Done (mirrors spec §8)

- [ ] Unauthenticated `GET /api/tweets` and `GET /api/dashboard/summary` → `401`.
- [ ] `/home` displays the full tweet history, newest first, sourced from the DB (not
      localStorage).
- [ ] Stats card shows correct total tweet count and unique author count; author
      breakdown lists each author's tweet count, highest first.
- [ ] Empty database → feed shows "No tweets yet" and stats/breakdown render `0`/empty
      states instead of breaking or showing `null`.
