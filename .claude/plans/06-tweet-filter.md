# Implementation Plan: 06-tweet-filters.md

Source spec: `.claude/specs/06-tweet-filters.md`

## 0. Discrepancy notes (read first)

- `CLAUDE.md` still describes Chirp as "frontend-only" with `localStorage`-simulated
  auth. That's stale — as already flagged in `.claude/plan/04-profile.md` and
  `.claude/plan/05-tweet-feed-dashboard.md`, steps 1–3 replaced that with a real
  backend (Express + SQLite in `server/`, JWT cookie sessions). Unlike those two specs,
  **this spec's own routes/SQL already match the real backend** — `GET /api/tweets` in
  `server/index.js` and the `tweets`/`users` schema in `server/db.js` are exactly what
  §3/§4 describe. No stale-spec rewrite needed here, just extending real code.
- Spec §3 only lists one enhanced endpoint (`GET /api/tweets`). `GET
  /api/dashboard/summary` (the stats/breakdown cards added in step 5) is **not**
  mentioned anywhere in this spec and is **not modified** by this plan — the stats
  card (`totalTweets`/`totalAuthors`) and author breakdown keep showing whole-database
  numbers regardless of the search box or scope toggle. Only the tweet list itself
  filters. This is a deliberate scope boundary, not an oversight — inventing a
  filtered-stats concept the spec never asked for would be scope creep.
- The existing `.home-tabs` in `Home.jsx` ("For you" / "Following") are decorative
  leftovers with no click handlers or wiring — same "unrelated pre-existing content"
  the 05 plan left alone for the trends card. This spec's "dedicated tab control" for
  `scope=mine` is a **new**, separate segmented control, not a repurposing of
  "Following" — there's no follow-graph/relationship data anywhere in the schema, so
  making "Following" mean "my tweets" would be semantically wrong. The old tabs stay
  as inert decoration; out of scope to wire or remove them here.
- Spec §7's "Secure Wildcard Bindings" rule and its `LIKE` example are already how
  `server/index.js` binds every other parameterized query in this codebase (see
  `register`/`login`) — just applying the same convention, nothing new to introduce.

## 1. Backend plan (`server/index.js`)

Modify the existing `GET /api/tweets` handler (currently lines 238–254) to build the
query conditionally from `req.query.scope` and `req.query.search`, keeping the same
inline-route, try/catch-then-500 convention as every other route in this file.

```js
app.get('/api/tweets', requireAuth, async (req, res) => {
  const db = getDb()
  const { scope, search } = req.query

  const conditions = []
  const params = []

  if (scope === 'mine') {
    conditions.push('tweets.user_id = ?')
    params.push(req.user.id)
  }

  const term = typeof search === 'string' ? search.trim() : ''
  if (term) {
    conditions.push('tweets.content LIKE ?')
    params.push(`%${term}%`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  try {
    const tweets = await db.allAsync(
      `SELECT tweets.id, tweets.content, tweets.created_at, users.username
       FROM tweets
       JOIN users ON tweets.user_id = users.id
       ${whereClause}
       ORDER BY tweets.created_at DESC, tweets.id DESC;`,
      params
    )

    res.json({ success: true, tweets })
  } catch (err) {
    console.error('Fetching tweets failed:', err)
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
})
```

Notes:
- `scope` is checked with `=== 'mine'` (allow-list, not "anything truthy") — any other
  or missing value is treated as the unfiltered global feed, matching spec §5A (only
  `scope=mine` is a documented value).
- `search`'s `%`/`_` wildcard bind stays a plain substring wrap (`%term%`) with no
  escaping of literal `%`/`_` characters the user might type — the spec's own example
  doesn't ask for that, and none of this codebase's existing queries do input escaping
  beyond parameter binding. Out of scope to add.
- Both conditions are joined with `AND` when present, per spec §5A's combined example
  (`?scope=mine&search=vite`) — order in the array doesn't matter for correctness.
- No CORS change needed — `GET` is already allowed and query-string params don't
  affect preflight.

## 2. Frontend plan

### 2.1 `src/lib/dashboard.js` — `fetchTweets` takes filter params

```js
export async function fetchTweets({ scope, search } = {}) {
  const params = new URLSearchParams()
  if (scope === 'mine') params.set('scope', 'mine')
  if (search?.trim()) params.set('search', search.trim())
  const qs = params.toString()

  let res
  try {
    res = await fetch(`${API_BASE}/api/tweets${qs ? `?${qs}` : ''}`, { credentials: 'include' })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, tweets: data.tweets }
  return { ok: false, error: data.error }
}
```

`fetchDashboardSummary` and `formatRelativeTime` are unchanged (see discrepancy note
above — summary stays unfiltered).

### 2.2 `src/pages/Home.jsx` — state

Add, alongside the existing state:

```js
const [scope, setScope] = useState('all') // 'all' | 'mine'
const [searchInput, setSearchInput] = useState('')   // live input value
const [debouncedSearch, setDebouncedSearch] = useState('') // value actually sent to the API
const [feedLoading, setFeedLoading] = useState(false) // refetch-in-flight, filters only
const [feedError, setFeedError] = useState('')
```

The existing `loading`/`error`/`tweets` state stay for the **initial** combined
load (tweets + dashboard summary together, exactly as today). `feedLoading`/
`feedError` are separate and only come into play for filter-driven refetches so
that changing the search box or scope toggle never hides the stats/breakdown cards
or flips the whole page back into the full-page loading state.

### 2.3 Debounce, without an infinite-loop risk

DoD item 2 explicitly calls out avoiding "infinite react layout loop states" — the
risk is a naive `useEffect` that both reads and writes the same state it depends on.
Avoid it with two separate effects and a plain `setTimeout`/`clearTimeout` debounce
(no extra dependency, no external library needed):

```js
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(searchInput.trim())
  }, 300)
  return () => clearTimeout(timer)
}, [searchInput])
```

This effect only depends on `searchInput` and only ever writes `debouncedSearch` — it
never feeds back into its own dependency, so it settles after one timer fire per
keystroke pause instead of looping.

### 2.4 Refetch effect + stale-response guard

A second effect refetches **tweets only** whenever the committed filters change,
skipping the very first render (that case is already covered by the existing
mount-time `Promise.all` effect):

```js
const isFirstRun = useRef(true)

useEffect(() => {
  if (isFirstRun.current) {
    isFirstRun.current = false
    return
  }

  let cancelled = false
  setFeedLoading(true)
  setFeedError('')

  fetchTweets({ scope, search: debouncedSearch }).then((result) => {
    if (cancelled) return
    if (!result.ok) {
      setFeedError(result.error)
    } else {
      setTweets(result.tweets)
    }
    setFeedLoading(false)
  })

  return () => {
    cancelled = true
  }
}, [scope, debouncedSearch])
```

The `cancelled` flag (same pattern already used in the mount effect) discards a
response from a stale request if the user changes the filter again before the first
one resolves — e.g. typing fast can fire several requests; only the latest one's
result is applied when it lands, regardless of arrival order.

The mount-time effect's own `fetchTweets()` call becomes `fetchTweets({ scope: 'all',
search: '' })` (i.e. its current no-args behavior, explicit) — no other change to that
effect.

### 2.5 Reset control

A "Reset" affordance clears both filters immediately, without waiting on the debounce
timer:

```js
function handleResetFilters() {
  setSearchInput('')
  setDebouncedSearch('')
  setScope('all')
}
```

Setting `debouncedSearch` directly (not just `searchInput`) means the refetch effect
in §2.4 fires right away on click; the pending 300ms timer from §2.3 will also fire
later and set the same already-`''` value, which is a harmless no-op re-render.

### 2.6 UI — filter bar

Add a new bar inside `.home-feed-header`, below the existing (untouched) `.home-tabs`:

```jsx
<div className="home-filter-bar">
  <input
    type="search"
    className="home-search-input"
    placeholder="Search tweets"
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
  />
  <div className="home-scope-toggle">
    <button
      type="button"
      className={`home-scope-btn${scope === 'all' ? ' home-scope-btn-active' : ''}`}
      onClick={() => setScope('all')}
    >
      All Tweets
    </button>
    <button
      type="button"
      className={`home-scope-btn${scope === 'mine' ? ' home-scope-btn-active' : ''}`}
      onClick={() => setScope('mine')}
    >
      My Tweets Only
    </button>
  </div>
  {(searchInput || scope === 'mine') && (
    <button type="button" className="home-filter-reset" onClick={handleResetFilters}>
      Reset
    </button>
  )}
</div>
```

The Reset button only renders when a filter is actually active, so it doesn't clutter
the bar on first load.

### 2.7 Feed list rendering — loading/error/empty states

Extend the existing conditional block (currently `loading`/`error`/empty/list) to also
account for `feedLoading`/`feedError`, and to distinguish the two different empty
messages the spec calls for:

```jsx
{loading && <p className="home-feed-status">Loading tweets…</p>}

{!loading && (error || feedError) && (
  <p className="home-feed-status home-feed-error">{error || feedError}</p>
)}

{!loading && !error && !feedError && feedLoading && (
  <p className="home-feed-status">Loading tweets…</p>
)}

{!loading && !error && !feedError && !feedLoading && tweets.length === 0 && (
  <div className="home-card home-feed-empty">
    <p>{scope === 'mine' || debouncedSearch ? 'No tweets match your search guidelines.' : 'No tweets yet'}</p>
  </div>
)}

{!loading && !error && !feedError && !feedLoading && tweets.length > 0 && (
  <ul className="tweet-list">{/* unchanged tweet.map(...) */}</ul>
)}
```

"A filter is active" is defined as `scope === 'mine' || debouncedSearch !== ''` —
this is the same condition used for showing the Reset button in §2.6, so the two stay
consistent (Reset visible exactly when the filtered-empty message, rather than the
plain "No tweets yet", would show).

### 2.8 `src/pages/Home.css` — new classes

Add alongside the existing `.home-tabs`/`.home-tab` rules, consuming only
`--chirp-*` custom properties per `CLAUDE.md`'s theming rule:

```css
.home-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--chirp-border);
  flex-wrap: wrap;
}

.home-search-input {
  flex: 1;
  min-width: 120px;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--chirp-border);
  border-radius: 9999px;
  background: var(--chirp-bg);
  color: var(--chirp-black);
  font-size: 0.85rem;
}

.home-scope-toggle {
  display: flex;
  gap: 0.3rem;
}

.home-scope-btn {
  border: 1px solid var(--chirp-border);
  background: transparent;
  color: var(--chirp-gray);
  border-radius: 9999px;
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.home-scope-btn-active {
  background: var(--chirp-blue);
  border-color: var(--chirp-blue);
  color: #fff;
}

.home-filter-reset {
  border: none;
  background: transparent;
  color: var(--chirp-blue);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}
```

No changes needed to the `@media (max-width: 1000px)` block — the filter bar sits in
the center feed column, which stays full-width at all breakpoints; `flex-wrap: wrap`
keeps it usable if the column gets narrow.

## 3. Files touched

**Backend**
- `server/index.js` — `GET /api/tweets` handler builds a conditional `WHERE` clause
  from `req.query.scope`/`req.query.search`.

**Frontend**
- `src/lib/dashboard.js` — `fetchTweets` accepts `{ scope, search }` and appends them
  as a query string.
- `src/pages/Home.jsx` — new filter state, debounce + refetch effects, filter bar UI,
  split loading/error states, dual empty-state messages.
- `src/pages/Home.css` — `.home-filter-bar`, `.home-search-input`,
  `.home-scope-toggle`, `.home-scope-btn`(`-active`), `.home-filter-reset`.

No database migration, no new endpoint, no change to `/api/dashboard/summary`.

## 4. Manual verification checklist (for you to run after implementation — I won't
self-test, per your standing preference; you drive this)

1. `npm run server` + `npm run dev`, log in as `mahesh` / `mahesh`, with at least a
   couple of tweets from more than one seeded/registered user already in the DB.
2. Type a keyword that matches some tweets' content → after a brief pause (~300ms)
   the list narrows to matches, stats/breakdown cards do **not** change.
3. Clear the search box → list instantly returns to the full global feed (no need to
   wait for a second debounce round-trip to feel broken).
4. Click "My Tweets Only" → list narrows to just your own tweets; click "All Tweets"
   → back to everyone's.
5. Combine both: type a keyword AND toggle "My Tweets Only" → results match both
   conditions (content contains the keyword AND authored by you).
6. Type something that matches nothing → feed shows "No tweets match your search
   guidelines." (not the plain "No tweets yet"). Clear the filters → if the DB is
   genuinely empty you'd see "No tweets yet" instead; otherwise the full feed returns.
7. Click "Reset" while a filter is active → search box clears, scope resets to "All
   Tweets", full feed reappears immediately, Reset button itself disappears.
8. Type quickly (many keystrokes in under 300ms) and watch the network tab / feed —
   confirm it doesn't fire a request per keystroke, and that a fast edit followed by
   a slower one doesn't leave the list showing results for an earlier, now-stale
   query (i.e. no flicker back to old results after the latest ones already loaded).
9. Log out (clear the cookie) and hit `GET /api/tweets?scope=mine` and `GET
   /api/tweets?search=react` directly → both `401`.
10. Toggle dark mode via `ThemeToggle` — confirm the search input and scope buttons
    use theme colors correctly in both modes.
11. Resize to a narrow width — confirm the filter bar wraps instead of overflowing
    or causing horizontal scroll.

## 5. Definition of Done (mirrors spec §8)

- [ ] Toggling "My Tweets Only" narrows the feed to the current user's own tweets
      immediately; toggling back restores the global feed.
- [ ] Typing in the search box refetches from the server without firing a request per
      keystroke and without any infinite re-render loop.
- [ ] Clearing the search text or clicking Reset instantly restores the full,
      chronological, unfiltered feed.
- [ ] An empty filtered result set shows "No tweets match your search guidelines.",
      distinct from the unfiltered empty-database "No tweets yet" message.
- [ ] `scope=mine` and `search=` combine correctly (AND, not OR) when both are active.
- [ ] Unauthenticated `GET /api/tweets` (with or without query params) → `401`.
