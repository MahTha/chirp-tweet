# Spec Document: 05-tweet-feed-dashboard.md

## 1. Overview

Replaces the in-memory React state (`useState(SEED_TWEETS)`) inside the home workspace with a persistent backend timeline feed dashboard showing three distinct pieces: **Tweet Feed History** (a list of persistent tweets), **Summary Stats** (global total tweets and unique user count metrics), and an **Author Breakdown** (per-user tweet counts). This is the milestone that officially hooks up the data layer to display real content from the database. It is a prerequisite for adding, editing, or deleting single tweets in future scopes.

---

## 2. Depends on

- Step 1 — Database setup (`01-database-setup.md`: `tweets` table layout).
- Step 3 — Active Session Lifecycle (`03-login-logout.md`: `requireAuth` routing guard middleware and token validation).

---

## 3. Routes

All communication payload schemas follow strict JSON format rules.

### A. Backend API (New)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Aggregates summary stats and author breakdowns across all users. | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/tweets` | Gathers chronologically ordered global timeline history joined with user details. | `200 OK`, `401 Unauthorized` |

---

## 4. Database Queries

The dashboard elements are extracted dynamically via parameterized selections across backend routes:

- **Summary Stats & Unique Voice Count:**
```sql
SELECT COUNT(*) as total_tweets, COUNT(DISTINCT user_id) as total_authors FROM tweets;
```

- **Author Breakdown List (Ranked Volume):**
```sql
SELECT users.username, COUNT(tweets.id) as tweet_count 
FROM tweets 
JOIN users ON tweets.user_id = users.id 
GROUP BY users.username 
ORDER BY tweet_count DESC;
```

---

## 5. API Design & Payloads

### A. Fetch Dashboard Summary Response (`GET /api/dashboard/summary`)
```json
{
  "success": true,
  "stats": {
    "totalTweets": 8,
    "totalAuthors": 1
  },
  "breakdown": [
    { "username": "mahesh", "tweet_count": 8 }
  ]
}
```

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Append and secure the `GET /api/dashboard/summary` and `GET /api/tweets` handlers with `requireAuth`.

### B. Frontend Workspace
- `src/pages/Home.jsx` — Replace the isolated React array hook state. In a `useEffect` block, perform asynchronous fetch operations targeting both new endpoints. Divide your page view column layout into dynamic segments consuming this data layout.

---

## 7. Rules for Implementation

- **Strict Server Separation:** All data processing, counting, and layout mapping calculations must happen inside the SQL query logic layers, not within client code processes.
- **Graceful Empty Fallbacks:** If the system features zero records, stats must explicitly report numerical `0` configurations without returning `null` or breaking React mapping blocks.
- **Parameterized Filters:** Maintain clean parameter maps when structuring database execution controllers.

---

## 8. Definition of Done

- [ ] Unauthenticated API requests targeting the dashboard infrastructure drop with `401 Unauthorized` flags.
- [ ] Visiting `/home` displays the complete historical feed index of tweets sorted by timestamps descending.
- [ ] The dashboard metrics layout correctly counts total platform content volume and displays high-volume user rankings.
- [ ] Empty database scenarios preserve working structural cards showcasing clear `"No tweets yet"` prompt warnings.
