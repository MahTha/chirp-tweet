# Spec Document: 06-tweet-filters.md

## 1. Overview

Adds a robust search filter bar and view toggle matrix to the signed-in workspace dashboard (`/home`) built in Step 5. Users can selectively parse data columns by feeding an input keyword parameter, or clicking a dedicated tab control to slice timeline statistics between a global app workflow and a self-isolated context (`"My Tweets Only"`). This ensures the timeline remains usable as database transaction volumes grow.

---

## 2. Depends on

- Step 1 — Database setup (`01-database-setup.md`: `tweets` schema date definitions).
- Step 5 — Persistent Feed Dashboard (`05-tweet-feed-dashboard.md`).

---

## 3. Routes

### A. Backend API (Enhanced Controllers)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tweets` | Upgraded to accept optional incoming query string parameter boundaries (`?scope=mine` or `?search=keyword`). | `200 OK`, `401 Unauthorized` |

---

## 4. Database Query Variations

The query string modifications enforce conditional query builders within the network backend controller context:

- **Isolated Timeline Filter Scenario (`?scope=mine`):**
```sql
SELECT tweets.id, tweets.content, tweets.created_at, users.username 
FROM tweets 
JOIN users ON tweets.user_id = users.id 
WHERE tweets.user_id = ? 
ORDER BY tweets.created_at DESC;
```

- **Fuzzy Phrase Match Scan Scenario (`?search=keyword`):**
```sql
SELECT tweets.id, tweets.content, tweets.created_at, users.username 
FROM tweets 
JOIN users ON tweets.user_id = users.id 
WHERE tweets.content LIKE ? 
ORDER BY tweets.created_at DESC;
```

---

## 5. API Design & Payloads

### A. Request Pattern Mapping Samples
- `GET /api/tweets?scope=mine` — Isolates response outputs to items authored exclusively by the requesting token owner context.
- `GET /api/tweets?search=React` — Returns matching items where content contains the string `"React"`.
- URL variables can combine safely: `GET /api/tweets?scope=mine&search=vite`.

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Modify your `GET /api/tweets` endpoint middleware function to explicitly check for incoming `req.query.scope` and `req.query.search` variables before processing SQL routines.

### B. Frontend Workspace
- `src/pages/Home.jsx` — Insert a search bar and a multi-tab selector layout item. Wire state inputs directly to trigger dynamic API call re-executions upon mutation.

---

## 7. Rules for Implementation

- **Secure Wildcard Bindings:** When processing string search queries, append wildcard percentage targets (`%`) entirely within the data variables array context, **never** inject strings directly into the raw text body of the query template.
  - *Correct:* `db.all("SELECT ... WHERE content LIKE ?", ['%' + queryVal + '%'], ...)`
- **Isolated Component Messages:** When filter results yield empty sets, render an distinct notification component saying: `"No tweets match your search guidelines."`

---

## 8. Definition of Done

- [ ] Toggling the timeline view scope changes layout arrays down to own-authored rows immediately.
- [ ] Entering text inside the text filter processes server queries smoothly without kicking off infinite react layout loop states.
- [ ] Removing text or resetting filter buttons instantly restores the global chronological feed dashboard metrics.
