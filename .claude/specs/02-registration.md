# Spec Document: 02-registration.md

## 1. Overview

Implements the backend API registration endpoint and wires up the existing frontend registration page to it. 

Currently, the React registration form (`src/pages/Register.jsx`) uses client-side simulated validation and writes account state to a mock array in `localStorage`. This step replaces that fake behavior with an async network request to the Express API server. 

After a successful registration, the application will redirect the user to the `/login` view. It does not implement automated log-in sessions yet—handling auth sessions is deferred to the next phase.

---

## 2. Depends on

- Step 1 — Database and Server Setup (`01-database-setup.md`). The Express app shell, `chirp.db` instance, and parameterized connection methods must already be fully functional.

---

## 3. Routes

All communication payload schemas follow strict JSON format rules.

### A. Backend API (New)

| Method | Endpoint | Description | Expected Status Codes |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Validates submission payload, verifies username uniqueness, hashes password string, inserts user row. | `201 Created`, `400 Bad Request`, `409 Conflict` |

### B. Frontend Views (Existing, Unchanged Flow)
- `/register` — Renders the registration form layout workspace.
- Redirects client to `/login` immediately upon successful registration response.

---

## 4. Database Changes

No layout structure alterations are required. The current `users` schema layout (`id`, `username`, `password_hash`, `created_at`) fully accommodates registration processing requirements.

---

## 5. API Design & Payloads

### A. Request Payload (`POST /api/auth/register`)
```json
{
  "username": "newuser",
  "password": "securepassword123"
}
```

### B. Success Response (`21 Created`)
```json
{
  "success": true,
  "message": "User registered successfully"
}
```

### C. Validation Failure Response (`400 Bad Request`)
```json
{
  "success": false,
  "error": "Username and password are required fields. Password must be at least 8 characters long."
}
```

### D. Duplicate Username Response (`409 Conflict`)
```json
{
  "success": false,
  "error": "This username is already taken."
}
```

---

## 6. Files to Change

### A. Backend Workspace
- `server/index.js` — Register and map the new `POST /api/auth/register` controller handler method.

### B. Frontend Workspace
- `src/lib/auth.js` / `src/context/AuthContext.jsx` — Replace the mock `register()` method. Strip out all read/write logic mapping to `localStorage.getItem('chirp.users')`. Instead, issue an asynchronous `fetch` request hitting the server API target `/api/auth/register`.

---

## 7. Files to Create

None.

---

## 8. Dependencies

No new packages. Uses the standard library structure along with `bcryptjs` added in Step 1.

---

## 9. Rules for Implementation

- **Strict Server Validation:** The server must explicitly validate that the username and password fields are present and that the password string contains at least **8 characters**. Do not rely on front-end browser form configurations alone.
- **Lowercase Usernames:** All incoming registration usernames must be converted via `.toLowerCase()` on the server before checking for duplicates or executing database inserts.
- **Secure Password Storage:** Raw plaintext passwords must never touch the database columns. Hash passwords using `bcryptjs` with a work factor cost of **10 salt rounds** before writing records.
- **Parameterized Queries Only:** Execute lookups and inserts using standard parameter bindings (`?`) to ensure security context enforcement.
- **Error Resolution Mechanics:** When registration fails due to server validation or conflict errors, return the matching error string alongside the relevant status code. The frontend should display this error value cleanly in the UI instead of crashing or redirecting.

---

## 10. Expected Behavior

- Registering a completely unique credentials combination saves a new row element to `users`, responds with a `201` status payload, and drives the client layout framework to load `/login`.
- Submitting an existing username value blocks database mutations, returns a `409` payload, and leaves the frontend form state intact while exposing the relevant error message to the user.
- Submitting a short password string (< 8 characters) returns a `400` validation flag from the server.

---

## 11. Definition of Done

- [ ] Submitting the registration form with clean data saves a row into the database's `users` table.
- [ ] Stored database profile rows display a robust cryptographic hash instead of plain user text keys.
- [ ] Attempting to register a user profile that already exists in the database yields a clear, visible UI warning.
- [ ] Submitting passwords under 8 characters blocks insertion processes via backend validation checks.
- [ ] A successful registration accurately triggers client redirection directly onto the `/login` view layer.
