import { Router } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import { requireAutomationKey } from "../middlewares/automation-key";

const router = Router();

// n8n polls this. Excludes tickets that already got a successful warning,
// so repeated runs never email twice.
router.get("/automation/at-risk-tickets", requireAutomationKey, async (_req, res) => {
  const result = await db.execute(sql`
    SELECT t.id, t.title, t.priority, t.status, t.sla_deadline AS "slaDeadline",
           u.email AS "agentEmail", u.full_name AS "agentName"
    FROM tickets t
    JOIN users u ON u.id = t.assigned_agent_id
    WHERE t.status NOT IN ('resolved', 'closed')
      AND now() >= t.created_at + (t.sla_deadline - t.created_at) * 0.75
      AND now() < t.sla_deadline
      AND NOT EXISTS (
        SELECT 1 FROM automation_logs l
        WHERE l.workflow = 'sla-warning' AND l.event_id = t.id::text AND l.status = 'success'
      )
  `);
  res.json({ tickets: result.rows });
});

const logBody = z.object({
  workflow: z.string().min(1).max(80),
  eventId: z.string().min(1).max(120),
  ticketId: z.string().uuid().nullish(),
  status: z.enum(["success", "failure"]),
  errorSummary: z.string().max(2000).nullish(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

// n8n's last step in every workflow. Upserts on (workflow, event_id).
router.post("/automation/logs", requireAutomationKey, async (req, res) => {
  const parsed = logBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const b = parsed.data;
  const err = b.errorSummary?.slice(0, 500) ?? null; // keep it short; n8n should redact first
  await db.execute(sql`
    INSERT INTO automation_logs (workflow, event_id, ticket_id, status, error_summary, started_at, finished_at)
    VALUES (${b.workflow}, ${b.eventId}, ${b.ticketId ?? null}, ${b.status}, ${err},
            ${b.startedAt ?? new Date().toISOString()}, ${b.finishedAt ?? new Date().toISOString()})
    ON CONFLICT (workflow, event_id) DO UPDATE
      SET status = EXCLUDED.status, error_summary = EXCLUDED.error_summary,
          finished_at = EXCLUDED.finished_at
  `);
  res.status(204).end();
});

export default router;