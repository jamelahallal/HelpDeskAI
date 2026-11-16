import { createHmac } from "node:crypto";
import { logger } from "./logger";

export type AutomationEvent = "ticket-created" | "ticket-p1" | "ticket-resolved";

// Free-tier n8n can take 30-60s to wake, so retry transient failures.
const RETRY_DELAYS_MS = process.env.NODE_ENV === "test" ? [0] : [0, 15_000, 45_000];

async function deliver(
  url: string,
  headers: Record<string, string>,
  body: string,
  event: string,
): Promise<void> {
  for (const [i, delay] of RETRY_DELAYS_MS.entries()) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) return;
      // 4xx (bad signature, inactive workflow) won't fix itself, so don't retry.
      if (res.status < 500 && res.status !== 429) {
        logger.warn({ event, status: res.status }, "automation webhook rejected");
        return;
      }
      throw new Error(`status ${res.status}`);
    } catch (err) {
      if (i === RETRY_DELAYS_MS.length - 1) {
        logger.warn({ err: String(err), event }, "automation webhook failed after retries");
      }
    }
  }
}

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

  void deliver(
    `${base}/${event}`,
    { "content-type": "application/json", "x-helpdesk-signature": `sha256=${signature}` },
    body,
    event,
  );
}