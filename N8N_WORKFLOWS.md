# n8n Workflows

## Status

n8n automation is a later phase. No n8n instance or workflow is connected to the Phase 1 application.

## Planned workflows

| Workflow | Trigger | Actions | Safety boundary |
| --- | --- | --- | --- |
| New ticket | Signed webhook after ticket creation | Request AI analysis, record result, notify support | AI recommendations remain suggestions; ticket changes require API authorization |
| SLA warning | Scheduled search for at-risk tickets | Notify the assigned agent; record an automation event | Recheck status and deadline before sending |
| SLA escalation | Breach or unresolved warning | Notify admin/manager and create an escalation event | Idempotent event key prevents duplicate escalation |
| Resolution follow-up | Ticket resolved | Wait, request feedback, store response | Do not reopen or close tickets automatically |

## Integration design

The API should publish signed, versioned events to n8n. Workflows should call authenticated API endpoints rather than write directly to PostgreSQL. The API remains the source of truth for role checks, status transitions, and audit records.

Store execution outcomes with workflow name, event identifier, start/end time, result, and a redacted error summary. Do not include session cookies, passwords, signing secrets, or full sensitive ticket text in automation logs.

## Local development plan

When this phase is implemented, Docker Compose should run n8n with persistent local storage and a development-only webhook secret. Document workflow import/export files and provide a safe way to replay test events without sending real notifications.
