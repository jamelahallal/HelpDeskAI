# Security

## Implemented in Phase 1

- Passwords are hashed with bcryptjs (12 rounds); plaintext passwords are never stored.
- JWT sessions are signed with `SESSION_SECRET`, expire after seven days, and are stored in an HttpOnly, SameSite=Lax cookie. The cookie is Secure in production.
- Every protected request reloads the user and current role from PostgreSQL.
- Requester, agent, and admin access checks are applied to ticket reads and actions. Internal notes are hidden from requesters.
- Inputs and outputs are checked against generated Zod schemas from the OpenAPI contract.
- Drizzle parameterizes database values.
- Helmet sets security headers; rate limits apply to the API and more tightly to sign-in/registration.
- CORS allows only configured origins. Same-origin application requests do not require a cross-origin allowlist.
- Ticket status, priority, comment, and assignment events are retained in audit history.
- Authentication headers, cookies, and response `Set-Cookie` values are excluded from structured request logs.
- Demo seed data is blocked when `NODE_ENV=production`.

## Configuration

Set `SESSION_SECRET` in Replit Secrets or the production platform's secret manager. It must be at least 32 characters. Do not put signing secrets, database credentials, API keys, or AWS credentials in Git or frontend variables.

Set `CORS_ORIGIN` to an explicit comma-separated list only if a separate frontend origin is needed. Do not use `*` with credentialed requests.

## Current limitations

Phase 1 is a portfolio foundation, not a compliance certification. Before production use, add and verify password recovery, email verification, MFA, CSRF defenses appropriate to the hosting topology, persistent/shared rate-limit storage, session revocation, dependency scanning, backups, retention rules, and operational alerting. Configure database and cloud access with least privilege.

The in-memory request limiter resets when the API process restarts and is not shared across replicas. Audit details should not contain secrets or unnecessary personal data.
