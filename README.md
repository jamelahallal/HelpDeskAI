# HelpDeskAI

HelpDeskAI is an IT helpdesk ticketing system built as a portfolio project. Requesters log support issues, agents and admins work them against SLA deadlines, an AI service suggests how to handle each ticket using a searchable knowledge base, and n8n workflows send the notifications and escalations.

The AI never acts on its own: every suggestion is shown to an agent, who decides whether to use it.

## What it does

- **Tickets.** Requesters register, create tickets, follow progress and close their own resolved tickets. Agents and admins assign, prioritise and progress them. Internal notes are hidden from requesters.
- **SLA tracking.** P1 1 hour, P2 4 hours, P3 8 hours, P4 24 hours (editable by an admin). A ticket at 75% of its window is *at risk*; past the deadline it is *breached*.
- **AI analysis.** When a ticket is created, the API asks a separate FastAPI service for a category, priority, urgency, summary, suggested team and a draft reply. Agents see this on the ticket and can copy the reply, use it as an update, or apply the suggested priority. Nothing is applied automatically.
- **Knowledge-base retrieval (RAG).** Articles are embedded and stored with pgvector. For each ticket the API runs a hybrid search (keyword plus vector similarity, merged with Reciprocal Rank Fusion) and passes only relevant articles to the AI service. Distance and margin cut-offs stop weak matches from being used.
- **Automation (n8n).** Four workflows: new ticket, SLA warning, resolution follow-up and P1 escalation. Every run is recorded in `automation_logs` and visible to admins on the Automation tab.
- **Admin area.** Create users, change roles, deactivate or reactivate accounts, reset passwords, edit SLA hours, and watch workflow successes and failures.
- **Resilience.** If the AI service is down or returns bad output, the ticket is still created and the failure is logged.

Ticket lifecycle: `new → assigned → in_progress → resolved → closed`. Assigning a ticket moves it to `assigned`. Skipping a step returns `409`.

## Architecture

```mermaid
flowchart LR
  Browser[React app] -->|"/api"| Web[nginx]
  Web --> API[Express API]
  API --> DB[("PostgreSQL + pgvector")]
  API -->|"embed / analyze"| AI[FastAPI AI service]
  API -->|"signed webhooks"| N8N[n8n]
  N8N -->|"logs, at-risk tickets"| API
  N8N --> Mail[Mailpit in dev / SMTP provider in production]
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model and request flow, [AI.md](AI.md) for the AI and retrieval design, [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md) for the workflows, [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Stack

- **Frontend:** React, Vite, TypeScript, Wouter, TanStack Query, served by nginx
- **API:** Node.js, Express 5, TypeScript, Pino, Helmet, express-rate-limit
- **Data:** PostgreSQL (Neon) with pgvector, Drizzle ORM
- **Contract:** OpenAPI with Orval-generated React Query hooks and Zod schemas
- **AI:** Python, FastAPI, 384-dimension `bge-small` embeddings, swappable text-model provider
- **Automation:** n8n, Mailpit for development-safe email
- **Packaging:** Docker and Docker Compose, pnpm workspaces
- **Tests:** Node test runner (API), Vitest and Testing Library (frontend)

## Run it locally

You need Docker Desktop, pnpm and a Postgres database with the pgvector extension (a free Neon project works).

1. Copy `.env.example` to `.env` and fill it in. Required values include `NEON_DATABASE_URL` (ending in `?sslmode=require`), `SESSION_SECRET` (32+ characters), `AI_SERVICE_TOKEN`, `AUTOMATION_WEBHOOK_SECRET`, `AUTOMATION_API_KEY` and `N8N_ENCRYPTION_KEY`. Generate each secret with:

   ```powershell
   -join (1..64 | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
   ```

2. Start the stack. The first run creates the database tables automatically:

   ```bash
   docker compose up -d --build
   ```

3. Optional demo data (development only):

   ```bash
   docker compose --profile seed run --rm seed
   ```

4. Run the AI service on port 8000 of your machine. The API reaches it at `host.docker.internal:8000`. See [AI.md](AI.md).

5. Set up n8n once at http://localhost:5678: create the owner account, import each file in `automation/workflows/` as its own workflow, add an SMTP credential (host `mailpit`, port `1025`, no authentication, SSL off), then publish all four.

| What | Where |
| --- | --- |
| The app | http://localhost:8080 |
| Caught emails (Mailpit) | http://localhost:8025 |
| n8n | http://localhost:5678 |

Demo users (password `HelpdeskDemo26!`, overridable with `DEMO_PASSWORD`):

| Role | Email |
| --- | --- |
| Requester | `requester@helpdesk.local` |
| Agent | `agent@helpdesk.local` |
| Admin | `admin@helpdesk.local` |

Never use the demo accounts or password in production.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEON_DATABASE_URL` | Database connection (passed to the containers as `DATABASE_URL`) |
| `SESSION_SECRET` | Signs session JWTs; 32+ characters |
| `CORS_ORIGIN` | Allowed browser origin; set by Compose from `WEB_PORT` |
| `TRUST_PROXY` | Number of proxies in front of the API, so client IPs and rate limits are correct |
| `COOKIE_SECURE` | `true` when served over HTTPS |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Where the AI service is and the shared token it expects |
| `KB_MAX_DISTANCE`, `KB_MARGIN` | Retrieval cut-offs (defaults `0.40` and `0.10`) |
| `AUTOMATION_WEBHOOK_SECRET` | Signs events sent from the API to n8n |
| `AUTOMATION_API_KEY` | Key n8n sends when calling the API back |
| `N8N_ENCRYPTION_KEY` | Encrypts n8n's stored credentials |
| `WEB_PORT`, `LOG_LEVEL`, `DEMO_PASSWORD` | Web port (default 8080), log level, seed password |

Never commit `.env`. Keep secrets in the host's secret store.

## API overview

- Auth: `POST /api/auth/register`, `login`, `logout`; `GET /api/auth/me`
- Tickets: `GET` and `POST /api/tickets`; `GET /api/tickets/{id}`; `POST …/comments`; `PATCH …/status`, `…/assignment`, `…/priority`
- Dashboard and directory: `GET /api/dashboard/summary`, `GET /api/users/agents`
- Admin (admin role only): `GET` and `POST /api/admin/users`, `PATCH /api/admin/users/{id}`, `GET /api/admin/sla-rules`, `PUT /api/admin/sla-rules/{priority}`, `GET /api/admin/automation-logs`
- Automation (shared key, used by n8n): `GET /api/automation/at-risk-tickets`, `POST /api/automation/logs`
- Health: `GET /api/healthz`

The contract lives in `lib/api-spec/openapi.yaml`. After changing it, regenerate the client and schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Tests

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run test:unit
pnpm --filter @workspace/helpdesk-ai run test
```

The API integration tests run against a throwaway Postgres container, never your real database. Start it once, then run the suite:

```powershell
docker compose --profile test up -d test-db
docker compose exec test-db psql -U test -d helpdesk_test -c "CREATE EXTENSION IF NOT EXISTS vector"
docker compose run --rm -e DATABASE_URL=postgres://test:test@test-db:5432/helpdesk_test db-setup
pnpm --filter @workspace/api-server run test
```

They cover sign-up and sign-in, role-based access, ticket creation, assignment and the status lifecycle. The frontend tests cover creating a ticket and updating its status.

## Project layout

```
artifacts/api-server/    Express API, routes, tests
artifacts/helpdesk-ai/   React app (pages/, components/, lib/)
lib/db/                  Drizzle schema
lib/api-spec/            OpenAPI contract
lib/api-zod/             Generated Zod schemas
lib/api-client-react/    Generated React Query hooks
automation/workflows/    n8n workflow exports
```

## Roadmap

Done: core app, Docker, AI service, RAG, n8n automation with Mailpit, admin automation view, backend and frontend tests.

Next:

1. **CI:** GitHub Actions running typecheck, tests, builds and Docker builds.
2. **Free deployment:** Docker Compose on a free virtual machine with automatic HTTPS, then a deploy workflow that only runs after CI passes. See [DEPLOYMENT.md](DEPLOYMENT.md).
3. **Hardening:** CSRF protection, password recovery, email verification and shared rate-limit storage. See [SECURITY.md](SECURITY.md).
