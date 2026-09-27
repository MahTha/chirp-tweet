# Spec Document: 07-post-tweet.md

## 1. Overview

Adds the ability for a signed-in user to actually compose and publish a new tweet from `/home`. Today the workspace sidebar has a `"Tweet"` action item and the center feed only ever renders historical rows pulled from the database — there is no input surface and no backend route that accepts new content, so a logged-in user has no way to post. This step introduces a `POST /api/tweets` endpoint tied to the authenticated session, plus a composer control on the client that submits to it and reflects the result in the feed and the summary/breakdown numbers immediately.

---

## 2. Depends on

- Step 1 — Database setup (`01-database-setup.md`: `tweets` table layout, `content` length constraint).
- Step 3 — Active Session Lifecycle (`03-login-logout.md`: `requireAuth` routing guard middleware and token validation).
- Step 5 — Persistent Feed Dashboard (`05-tweet-feed-dashboard.md`: feed list plus summary stats/author breakdown that must reflect newly created rows).
- Step 6 — Tweet Filters (`06-tweet-filters.md`: `scope`/`search` state the feed already tracks; a newly posted tweet must be evaluated against whatever filter is currently active, not force-reset it).

---

## 3. Routes

### A. Backend API (New)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/tweets` | Inserts a new tweet row scoped to the authenticated session's user id. | `201 Created`, `400 Bad Request`, `401 Unauthorized` |

---

## 4. Database Queries

- **Insert new tweet:**
```sql
INSERT INTO tweets (user_id, content) VALUES (?, ?);
```

- **Read back the created row for the response payload:**
```sql
SELECT id, content, created_at FROM tweets WHERE id = ?;
```

---

## 5. API Design & Payloads

### A. Create Tweet Request (`POST /api/tweets`)
```json
{
  "content": "Shipping the composer today."
}
```

### B. Create Tweet Success Response (`201 Created`)
```json
{
  "success": true,
  "tweet": {
    "id": 9,
    "content": "Shipping the composer today.",
    "created_at": "2026-09-24 10:00:00",
    "username": "mahesh"
  }
}
```

### C. Validation Failure Response (`400 Bad Request`)
```json
{
  "success": false,
  "error": "Tweet content is required and must be 280 characters or fewer."
}
```

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Add the `POST /api/tweets` handler behind `requireAuth`, following the existing inline-route, try/catch-then-500 convention used by every other route in this file.
- `server/db.js` — Extend the connection helper set (alongside `runAsync`/`getAsync`/`allAsync`) so the new route can retrieve the inserted row's id without a second, racy query.

### B. Frontend Workspace
- `src/lib/dashboard.js` — Add a `postTweet(content)` function following the same `credentials: 'include'` / network-failure / `data.success` branching shape as `fetchTweets` and `fetchDashboardSummary`.
- `src/pages/Home.jsx` — Add a composer control to the feed column and wire the existing (currently inert) sidebar `"Tweet"` button to it. On a successful post, refresh both the tweet list (respecting the current `scope`/`search` filters) and the summary/breakdown cards.
- `src/pages/Home.css` — Styling for the composer, consuming existing `--chirp-*` custom properties only.

---

## 7. Rules for Implementation

- **Server-side validation is mandatory, not just a UI nicety:** reject empty (post-trim) or over-280-character content with `400`, even though the database column already carries a `CHECK` constraint — a constraint violation must never surface to the client as a raw `500`.
- **Trim before validating and storing:** whitespace-only content is treated as empty.
- **No forced filter reset:** posting a tweet must not silently clear an active search term or flip `"My Tweets Only"` back to `"All Tweets"` — the refreshed feed is evaluated against whatever filter state was already active.
- **The sidebar `"Tweet"` action must do something:** it cannot remain a click target with no handler; at minimum it must bring the composer into focus.
- **No client-side echo without confirmation:** don't optimistically splice the new tweet into local state from the client's own guess of its shape — reconcile with the server's response (real `id`/`created_at`) before it's treated as posted.

---

## 8. Definition of Done

- [ ] Submitting non-empty content of 280 characters or fewer creates a row in `tweets` owned by the logged-in user and appears in the feed without a manual page refresh.
- [ ] Submitting empty or whitespace-only content is blocked in the UI and rejected with `400` if sent directly to the API.
- [ ] Content over 280 characters is blocked in the UI and rejected with `400` if sent directly to the API.
- [ ] The summary stats card's total tweet count and the author breakdown update to include the new tweet.
- [ ] The sidebar `"Tweet"` button is no longer a dead click target.
- [ ] Unauthenticated `POST /api/tweets` requests are rejected with `401 Unauthorized`.
