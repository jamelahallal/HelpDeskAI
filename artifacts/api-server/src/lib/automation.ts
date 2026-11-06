import { createHmac } from "node:crypto";
import { logger } from "./logger"; // use your existing Pino instance

export type AutomationEvent = "ticket-created" | "ticket-p1" | "ticket-resolved";

/** Fire-and-forget: never blocks or fails the request that triggered it. */
export function emitAutomationEvent(
  event: AutomationEvent,
  eventId: string,
  data: Record<string, unknown>,
): void {
  const base = process.env.AUTOMATION_WEBHOOK_URL;
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET;
  if (!base || !secret) return;

  const body = JSON.stringify({ eventId, event, occurredAt: new Date().toISOString(), data });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  fetch(`${base}/${event}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-helpdesk-signature": `sha256=${signature}` },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch((err) => logger.warn({ err: String(err), event }, "automation webhook failed"));
}