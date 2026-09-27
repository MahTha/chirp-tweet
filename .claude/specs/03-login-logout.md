# Spec Document: 03-login-logout.md

## 1. Overview

Implements secure backend session management, user authentication, and profile tracking via the login and logout endpoints.

Currently, the React login sequence (`src/pages/Login.jsx`) validates inputs against a fake browser array and mocks user persistence in `localStorage`. This step replaces that simulated engine with a real backend verification workflow. 

It implements cookie-based or token-based session verification, establishes secure private page validation via a session lookup endpoint (`/api/auth/me`), and updates the application's global `AuthContext` to manage live server-side validation.

---

## 2. Depends on

- Step 1 — Database setup (`01-database-setup.md`)
- Step 2 — Registration pipeline (`02-registration.md`)

---

## 3. Routes

All communication payload schemas follow strict JSON format rules.

### A. Backend API (New)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Validates credentials against DB. Creates a secure session state. | `200 OK`, `400 Bad Request`, `401 Unauthorized` |
| `POST` | `/api/auth/logout` | Destroys active session state and clears identity markers. | `200 OK` |
| `GET` | `/api/auth/me` | Validates authorization token/cookie; returns authenticated profile data. | `200 OK`, `401 Unauthorized` |

### B. Frontend Views (Existing, Behavior Updated)
- `/login` — Form layout state updates from network validation outcomes.
- `/home` — Guarded automatically via real network session lookups instead of simulated keys.

---

## 4. Database Changes

No layout structure alterations are required. The current `users` schema layout handles credential validation lookups natively.

---

## 5. API Design & Payloads

### A. Login Request Payload (`POST /api/auth/login`)
```json
{
  "username": "mahesh",
  "password": "mahesh"
}
```

### B. Authenticated Profile Response (`GET /api/auth/me` and Success `POST /api/auth/login`)
```json
{
  "success": true,
  "user": {
    "id": "a1b2c3d4e5f6g7h8",
    "username": "mahesh"
  }
}
```

### C. Authentication Failure Response (`401 Unauthorized`)
```json
{
  "success": false,
  "error": "Invalid username or password credentials."
}
```

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Implement handlers for `/api/auth/login`, `/api/auth/logout`, and `/api/auth/me`. Integrate a lightweight token mechanism (such as JWT) or session engine.

### B. Frontend Workspace
- `src/lib/auth.js` & `src/context/AuthContext.jsx` — **Completely purge all remaining references to `localStorage.removeItem('chirp.session')` and mock data tracking.** Rewrite `login()` and `logout()` hook methods to interact directly with the new `/api/auth/*` endpoints. 
- `src/context/AuthContext.jsx` — Update initialization logic to call `GET /api/auth/me` on mount to revalidate existing sessions across page refreshes.

---

## 7. Files to Create

- `server/middleware/auth.js` — Create a reusable server-side middleware router guard (`requireAuth`) that checks for valid sessions before granting access to future protected data streams.

---

## 8. Dependencies

Install one of the following packages based on your preferred backend session mechanism:
- `jsonwebtoken` (For stateless token tokens) OR `express-session` (For stateful backend cookie storage).

---

## 9. Rules for Implementation

- **No Cleartext Matching:** Always use `bcryptjs.compare()` to check incoming passwords against the database `password_hash` records.
- **Isolate Browser Preferences:** The user profile data flow belongs on the server, but theme states (`chirp.theme`) must **remain inside browser `localStorage`** since they are client UI preferences.
- **Normalize Queries:** Convert all login usernames via `.toLowerCase()` before querying the data row to avoid casing friction.
- **Fail Securely:** Do not specify whether the username or the password was incorrect when a login attempt fails. Use a generic fallback error string: `"Invalid username or password credentials."`

---

## 10. Expected Behavior

- Entering correct details for the seeded account (`mahesh`/`mahesh`) logs the user in successfully, establishes an encrypted session validation token, and opens access to `/home`.
- Manually refreshing the browser tab while viewing `/home` issues a quiet background verification call to `GET /api/auth/me` to prevent unexpected login drop-outs.
- Triggering the logout action deletes the active session identity data entirely, immediately blocking access to `/home` and forcing an application redirect back to `/login`.

---

## 11. Definition of Done

- [ ] Submitting correct user records through the interface maps directly to backend validation systems.
- [ ] Submitting failed combinations returns a distinct `401 Unauthorized` protocol status code.
- [ ] Active authentication sessions survive manual page reloads seamlessly via persistent token validations.
- [ ] Accessing `/api/auth/me` without an active session credentials payload safely yields an authentication failure response instead of throwing a server error.
- [ ] Activating the sign-out button renders previous credential configurations fully obsolete until the user re-authenticates.
