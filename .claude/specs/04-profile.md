# Spec Document: 04-profile.md

## 1. Overview

Implements the user profile architecture for Chirp. This replaces client-side simulated fields with live server endpoints allowing authenticated users to manage their public profile attributes (e.g., username metadata) and securely update their account passwords.

It builds directly on top of the backend API data streams and request validation layers created in the previous milestones.

---

## 2. Depends on

- Step 1 — Database Foundation (`01-database-setup.md`)
- Step 2 — Registration Management (`02-registration.md`)
- Step 3 — Active Session Lifecycle (`03-login-logout.md`) — Requires active backend verification token checks and the `requireAuth` server middleware wrapper.

---

## 3. Routes

All communication payload schemas follow strict JSON format rules.

### A. Backend API (New Endpoints)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users/profile` | Fetches active profile metadata (username, creation date). | `200 OK`, `401 Unauthorized` |
| `PUT` | `/api/users/profile` | Updates profile account records (username modification). | `200 OK`, `400 Bad Request`, `409 Conflict`, `401 Unauthorized` |
| `PUT` | `/api/users/password` | Re-evaluates current credentials and applies new hash codes. | `200 OK`, `400 Bad Request`, `401 Unauthorized` |

### B. Frontend Views (Existing, Logic Updated)
- `/profile` (or a structural settings overlay within `/home`) — Connects visual text fields to live state updates via `GET /api/users/profile`.

---

## 4. Database Changes

No layout structure alterations are required. It leverages the existing structural parameters within the `users` schema layout.

---

## 5. API Design & Payloads

### A. Fetch Profile Metadata Response (`GET /api/users/profile`)
```json
{
  "success": true,
  "profile": {
    "id": "a1b2c3d4e5f6g7h8",
    "username": "mahesh",
    "created_at": "2026-09-24 18:02:00"
  }
}
```

### B. Profile Update Payload (`PUT /api/users/profile`)
```json
{
  "username": "mahesh_new"
}
```

### C. Password Modification Payload (`PUT /api/users/password`)
```json
{
  "currentPassword": "mahesh_old_password",
  "newPassword": "super_secure_new_pass_123"
}
```

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Register network route endpoints matching the `/api/users/*` controller map routines. Inject `requireAuth` checking behaviors across all three targets.

### B. Frontend Workspace
- `src/context/AuthContext.jsx` — Append dynamic update parameters into exposed contexts so frontend layouts can update global layout text states instantly when a user changes their username string.
- `src/pages/Profile.jsx` (or matching visual setting interface files) — Replace existing in-memory mock mutations with async API triggers linking forms to the new server routes.

---

## 7. Files to Create

None.

---

## 8. Dependencies

No new dependencies. Uses standard packages configuration layouts configured in steps 1-3.

---

## 9. Rules for Implementation

- **Guarded Endpoints:** All profile manipulation endpoints must be strictly wrapped inside the backend `requireAuth` middleware step. Unauthenticated requests must reject immediately with a `401 Unauthorized` block flag.
- **Lowercase Rules:** New username strings parsed inside the update profile routing layer must be systematically cast via `.toLowerCase()` before evaluation checks occur.
- **Duplicate Exclusion Checking:** When evaluating uniqueness constraints for username change requests, ensure your database selector check explicitly excludes the current active user id entity parameter (`WHERE username = ? AND id != ?`). This ensures that re-submitting an unchanged username does not throw a duplicate conflict error.
- **Chronological Verification Steps:** Password validation sequences executed within the controller must verify data parameters exactly in this order:
  1. Presence confirmation check (ensure inputs are not blank or empty strings).
  2. Plaintext comparison match check via `bcryptjs.compare()` against the stored `password_hash`.
  3. Minimum length boundary evaluation (Ensure the incoming replacement string has a length **\(\ge\) 8 characters**).
- **Independent State Scoping:** Keep the form visual error/success states contextually separate on the frontend interface so validating profile field data mutations never accidentally wipes clean concurrent password mutation messaging parameters.

---

## 10. Expected Behavior

- Opening the account management settings pane successfully renders accurate, non-stale information parsed directly from active database state layers.
- Changing a handle value updates the global navigation states instantly across the client app without requiring an interface hard refresh.
- Providing an incorrect confirmation sequence string under password mutation fields blocks changes and yields an explicitly safe error mapping value back onto the front end interface.

---

## 11. Definition of Done

- [ ] Unauthenticated API requests targeting profile tracking features fail with `401 Unauthorized` flags.
- [ ] Changing a profile identifier column validates correctly, updates the active database record rows, and updates tracking tokens.
- [ ] Attempting to change an identity handle to a name currently assigned to another user returns a clean `409 Conflict` block.
- [ ] Submitting verification passwords below length rules threshold (< 8 characters) triggers an automated validation failure.
- [ ] Completing password adjustments invalidates older credentials immediately, while active cryptographic comparison verification functions cleanly upon subsequent authentication cycles.
