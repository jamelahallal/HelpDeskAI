# Security

## Implemented

**Accounts and sessions**
- Passwords are hashed with bcryptjs (12 rounds). Plaintext passwords are never stored or logged.
- Sessions are signed JWTs (`SESSION_SECRET`, at least 32 characters) in an HttpOnly, SameSite=Lax cookie that expires after seven days. The cookie is Secure in production, or when `COOKIE_SECURE=true`.
- Every protected request reloads the user and role from the database, so deactivating an account or changing a role takes effect immediately.
- Sign-in returns the same error for a wrong password and an unknown email, so accounts cannot be enumerated. Deactivated accounts cannot sign in.

**Authorization**
- Ticket reads and actions are checked by role. Requesters see only their own tickets, and internal notes are hidden from them. Requesters cannot assign, change priority, or move a ticket forward; they may only close their own resolved tickets.
- `/api/admin/*` is admin-only. An admin cannot change their own role or deactivate themselves.
- AI analysis is visible only to agents and admins.
- The authorization rules are covered by automated tests that run against a throwaway database.

**Input and output**
- Requests and responses are validated against Zod schemas generated from the OpenAPI contract. Drizzle parameterizes all database values.
- Helmet sets security headers. CORS allows only listed origins.

**Rate limiting and proxies**
- The API is limited to 300 requests a minute per client, and sign-in and registration to 10 attempts per 15 minutes.
- `TRUST_PROXY` sets how many proxies sit in front of the API, so the limiter sees real client addresses. Never set it to `true`, which lets clients spoof their address.

**Automation**
- Events from the API to n8n are HMAC-SHA256 signed and verified before any action.
- n8n calls back with a separate shared key, compared in constant time. The webhook secret and the callback key are different values.
- Automation logs store a truncated error summary only.

**Audit and logging**
- Status, priority, assignment, comment, user and SLA-rule changes are written to the audit log. Password changes record only that a reset happened.
- Authorization headers, cookies and `Set-Cookie` values are excluded from request logs.
- Demo seed data cannot run when `NODE_ENV=production`.

## Secrets

Keep every secret in `.env` locally (never committed) and in the host's secret store in production: `SESSION_SECRET`, `NEON_DATABASE_URL`, `AI_SERVICE_TOKEN`, `AUTOMATION_WEBHOOK_SECRET`, `AUTOMATION_API_KEY`, `N8N_ENCRYPTION_KEY` and any SMTP credentials. Generate each with a long random value. If a secret is ever committed, rotate it; deleting the file does not remove it from Git history.

## Not implemented yet

This is a portfolio project, not a compliance-certified product. These gaps are known and should be closed before real use:

- **CSRF protection.** Cookies are SameSite=Lax, which blocks most cross-site requests, but there is no CSRF token. When added, the `/api/automation/*` routes must be exempt because n8n authenticates with a key, not a cookie.
- **Password recovery and email verification.** There is no "forgot password" flow, and new accounts are not verified by email.
- **Multi-factor authentication** and **session revocation** (a stolen token stays valid until it expires or the account is deactivated).
- **Shared rate-limit storage.** The limiter keeps counts in memory, so they reset on restart and are not shared across several API instances.
- **Dependency and container scanning** in CI, and image tags pinned to exact versions.
- **Backups and retention rules.** Rely on the database provider's backups and check their retention.

Audit details should not contain secrets or unnecessary personal data.
