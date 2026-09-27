# Implementation Plan: 07-post-tweet.md

Source spec: `.claude/specs/07-post-tweet.md`

## 0. Discrepancy notes (read first)

- This spec's own routes/payloads already match the real backend shape (Express +
  SQLite in `server/`, JWT cookie sessions) — same situation as `06-tweet-filter.md`,
  unlike the stale rewrites `04-profile.md`/`05-tweet-feed-dashboard.md` had to do.
  Nothing here contradicts existing code; this plan only adds to it.
- **Why this bug exists**: step 5's plan (`.claude/plans/05-tweet-feed-dashboard.md`
  §1) deliberately *removed* the old localStorage-backed composer because there was no
  server endpoint to back it, and left the sidebar `"Tweet"` button in place with no
  `onClick` — it's inert decoration, exactly like the `.home-tabs` buttons step 6 also
  found and left alone. This plan is the first one that actually needs that button to
  do something, so it gets wired up here instead of staying decorative.
- **`runAsync` cannot give us the inserted row's id.** `server/db.js` builds
  `runAsync`/`getAsync`/`allAsync` via `promisify(conn.run.bind(conn))` etc.
  `sqlite3`'s `run()` callback is `function (err)` — the inserted id (`lastID`) is only
  reachable via `this` *inside that callback*, and `util.promisify` discards that;
  the resulting promise always resolves to `undefined`. Two ways around it:
  1. Query `SELECT ... WHERE id = last_insert_rowid()` right after the insert.
  2. Add one more non-promisify-based helper to the connection that captures
     `this.lastID` directly.
  Option 1 is racy in principle if two requests share the single `dbInstance`
  connection and interleave between the insert and the follow-up read. Option 2 has no
  such window. This plan uses option 2: a small `runInsertAsync` helper added next to
  the other three in `getDb()` — same call-site ergonomics (`await
  db.runInsertAsync(sql, params)`), zero new abstraction layers, nothing else changes
  about how `db.js` works.
- **Username without a join.** The JWT payload (`server/middleware/auth.js`
  `signToken`) already embeds `username`, and `requireAuth` puts it on `req.user`. The
  new route can build the response tweet as `{ ...insertedRow, username:
  req.user.username }` — no need to re-join `users` for a value already sitting on the
  request.
- **Scope decision: reconciling the new tweet with active filters.** Spec §7 forbids
  resetting the filter state, but says nothing about *forcing* the new tweet to appear
  when it wouldn't match the currently active filter (e.g. user has typed a search term
  their new tweet's content doesn't contain). Decision: don't special-case it. After a
  successful post, just re-run the same `fetchTweets({ scope, search: debouncedSearch
  })` + `fetchDashboardSummary()` the filter-changing effect already uses (see
  `06-tweet-filter.md` §2.4) — the server is the single source of truth for what's
  visible under the current filter, exactly like every other feed update in this app.
  If the active search term doesn't match the user's own new tweet, it correctly
  doesn't show up until they clear the filter. That's consistent, not a bug to work
  around.

## 1. Backend plan

### 1.1 `server/db.js` — new `runInsertAsync` helper

Add alongside the other three helpers already attached in `getDb()`:

```js
export function getDb() {
  if (dbInstance) return dbInstance

  const conn = new sqlite3.Database(DB_PATH)
  conn.runAsync = promisify(conn.run.bind(conn))
  conn.getAsync = promisify(conn.get.bind(conn))
  conn.allAsync = promisify(conn.all.bind(conn))
  conn.runInsertAsync = (sql, params = []) =>
    new Promise((resolve, reject) => {
      conn.run(sql, params, function (err) {
        if (err) reject(err)
        else resolve(this.lastID)
      })
    })

  dbInstance = conn
  return dbInstance
}
```

`function (err) { ... }` (not an arrow function) is required here — the `this` binding
sqlite3 sets on the callback is exactly what carries `lastID`.

### 1.2 `server/index.js` — `POST /api/tweets`

Add after the existing `GET /api/tweets` handler, same inline-route/try-catch-then-500
convention as every other route in the file:

```js
app.post('/api/tweets', requireAuth, async (req, res) => {
  const { content } = req.body ?? {}
  const trimmed = typeof content === 'string' ? content.trim() : ''

  if (!trimmed || trimmed.length > 280) {
    return res.status(400).json({
      success: false,
      error: 'Tweet content is required and must be 280 characters or fewer.',
    })
  }

  const db = getDb()

  try {
    const id = await db.runInsertAsync(
      'INSERT INTO tweets (user_id, content) VALUES (?, ?);',
      [req.user.id, trimmed]
    )
    const row = await db.getAsync('SELECT id, content, created_at FROM tweets WHERE id = ?;', [id])

    res.status(201).json({
      success: true,
      tweet: { ...row, username: req.user.username },
    })
  } catch (err) {
    console.error('Posting tweet failed:', err)
    res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' })
  }
})
```

Notes:
- Validation mirrors the `280` `CHECK` constraint already on the `tweets` table
  (`server/db.js`) — the constraint is a last-resort backstop, not the primary
  guard, per spec §7.
- No CORS change needed — `POST` is already in `Access-Control-Allow-Methods`.

## 2. Frontend plan

### 2.1 `src/lib/dashboard.js` — `postTweet`

```js
export async function postTweet(content) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/tweets`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' }
  }

  const data = await res.json()
  if (data.success) return { ok: true, tweet: data.tweet }
  return { ok: false, error: data.error }
}
```

Same shape as `fetchTweets`/`fetchDashboardSummary` — network failure caught, else
branch on `data.success`.

### 2.2 `src/pages/Home.jsx` — composer state + ref

Add alongside the existing state:

```js
const [composerText, setComposerText] = useState('')
const [posting, setPosting] = useState(false)
const [postError, setPostError] = useState('')
const composerRef = useRef(null)
```

Import `postTweet` from `../lib/dashboard` alongside the existing imports.

### 2.3 Submit handler

```js
async function handleSubmitTweet(e) {
  e.preventDefault()
  const trimmed = composerText.trim()
  if (!trimmed || trimmed.length > 280 || posting) return

  setPosting(true)
  setPostError('')

  const result = await postTweet(trimmed)

  if (!result.ok) {
    setPostError(result.error)
    setPosting(false)
    return
  }

  setComposerText('')
  setPosting(false)

  const [tweetsResult, summaryResult] = await Promise.all([
    fetchTweets({ scope, search: debouncedSearch }),
    fetchDashboardSummary(),
  ])
  if (tweetsResult.ok) setTweets(tweetsResult.tweets)
  if (summaryResult.ok) {
    setStats(summaryResult.stats)
    setBreakdown(summaryResult.breakdown)
  }
}
```

Both refetches run regardless of each other's outcome (`Promise.all` + independent
`if (result.ok)` checks) — a transient failure on one shouldn't block updating the
other, and neither should crash the page (mirrors the tolerant style already used in
the mount effect).

### 2.4 Composer JSX

Placed inside `<main className="home-feed">`, immediately after the closing
`</header>` of `.home-feed-header` and before the existing
loading/error/empty/list conditional block — same position a real composer occupies
above a chronological feed:

```jsx
<form className="composer" onSubmit={handleSubmitTweet}>
  <Avatar name={user?.username ?? 'You'} />
  <div className="composer-body">
    <textarea
      ref={composerRef}
      className="composer-input"
      placeholder="What's happening?"
      value={composerText}
      maxLength={280}
      onChange={(e) => setComposerText(e.target.value)}
    />
    {postError && <p className="composer-error">{postError}</p>}
    <div className="composer-footer">
      <span className="composer-count">{280 - composerText.length}</span>
      <button
        type="submit"
        className="btn btn-primary composer-submit"
        disabled={!composerText.trim() || composerText.length > 280 || posting}
      >
        {posting ? 'Posting…' : 'Tweet'}
      </button>
    </div>
  </div>
</form>
```

- `maxLength={280}` on the textarea stops most over-length input at the source; the
  `disabled` check on the button is the real client-side gate (defense in depth, same
  pattern as trimming twice — client convenience, server authority).
- The character counter is a plain countdown (`280 - length`), no color-coded warning
  states — consistent with "no skeleton loaders, just conditional text" restraint
  already called out in `05-tweet-feed-dashboard.md` §3.3 for this codebase's current
  level of polish.

### 2.5 Wiring the sidebar `"Tweet"` button

Currently (in `Home.jsx`):

```jsx
<button type="button" className="btn btn-primary btn-wide home-tweet-btn">
  <span>Tweet</span>
</button>
```

Change its `onClick` to bring the composer into view and focus it — it does not open a
separate modal (no modal system exists anywhere else in this codebase; introducing one
for a single textarea would be scope creep beyond what the spec's DoD asks for, which
is only that the button "does something"):

```jsx
<button
  type="button"
  className="btn btn-primary btn-wide home-tweet-btn"
  onClick={() => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    composerRef.current?.focus()
  }}
>
  <span>Tweet</span>
</button>
```

The composer sits near the top of the feed column already (§2.4), so the scroll is a
no-op in the common case and only matters after scrolling down a long feed.

### 2.6 `src/pages/Home.css` — new classes

Add near the existing `.tweet`/`.tweet-*` rules, consuming only `--chirp-*` custom
properties per `CLAUDE.md`'s theming rule:

```css
.composer {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  border-bottom: 1px solid var(--chirp-border);
}

.composer-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.composer-input {
  width: 100%;
  min-height: 70px;
  border: none;
  resize: vertical;
  background: transparent;
  color: var(--chirp-black);
  font-size: 1rem;
  font-family: inherit;
  line-height: 1.4;
}

.composer-input:focus {
  outline: none;
}

.composer-error {
  margin: 0;
  color: #f4212e;
  font-size: 0.85rem;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.composer-count {
  color: var(--chirp-gray);
  font-size: 0.8rem;
}

.composer-submit {
  padding: 0.45rem 1.2rem;
  font-size: 0.85rem;
}
```

`#f4212e` matches the existing `.home-feed-error` color already used elsewhere in this
file — reusing the established error color rather than inventing a new one.

No changes needed to the `@media (max-width: 1000px)` block — the composer lives in
the center feed column, which stays full-width at every breakpoint, same as the filter
bar from step 6.

## 3. Files touched

**Backend**
- `server/db.js` — adds `runInsertAsync` helper to `getDb()`.
- `server/index.js` — new `POST /api/tweets` route behind `requireAuth`.

**Frontend**
- `src/lib/dashboard.js` — adds `postTweet(content)`.
- `src/pages/Home.jsx` — composer state/handler/JSX; sidebar `"Tweet"` button gets a
  real `onClick`.
- `src/pages/Home.css` — `.composer` and related classes.

No database migration — reuses the existing `tweets` table from step 1.

## 4. Manual verification checklist (for you to run after implementation — I won't
self-test, per your standing preference; you drive this)

1. `npm run server` + `npm run dev`, log in as `mahesh` / `mahesh`.
2. Type a short tweet in the composer and submit → it appears at the top of the feed
   immediately, no manual refresh; the stats card's "Total tweets" count increments by
   one; the author breakdown's `mahesh` row count increments (or a new row appears for
   a first-time author).
3. Try submitting empty content (composer left blank) → submit button stays disabled;
   nothing is sent.
4. Try submitting whitespace-only content (just spaces) → same as above.
5. Paste in content over 280 characters → typing is capped at 280 by the textarea; if
   you bypass that (devtools) and hit the API directly with a 281+ character body →
   `400` with the spec's exact error message.
6. Click the sidebar `"Tweet"` button while scrolled down the feed → the composer
   scrolls into view and gets focus.
7. Set the scope toggle to `"My Tweets Only"` or type an active search term, then post
   a new tweet whose content doesn't match that search term → the new tweet does not
   appear until the filter is cleared or changed (expected per §0's scope decision);
   confirm the filter itself was **not** reset by the act of posting.
8. Log out (clear the cookie) and `POST /api/tweets` directly with a valid body →
   `401`.
9. Toggle dark mode via `ThemeToggle` — confirm the composer's text, placeholder, and
   error message use theme colors correctly in both modes.
10. Resize to ≤1000px width — confirm the composer still renders sensibly in the
    single-column mobile layout (feed column stays full width per the existing
    breakpoint).

## 5. Definition of Done (mirrors spec §8)

- [ ] Posting non-empty content ≤280 characters creates a row in `tweets` for the
      logged-in user and appears in the feed without a manual refresh.
- [ ] Empty/whitespace-only content is blocked client-side and rejected `400`
      server-side.
- [ ] Content over 280 characters is blocked client-side and rejected `400`
      server-side.
- [ ] Summary stats and author breakdown update to include the new tweet.
- [ ] The sidebar `"Tweet"` button is no longer a dead click target.
- [ ] Unauthenticated `POST /api/tweets` → `401`.
