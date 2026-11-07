import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  GetTicketFeedbackParams,
  GetTicketFeedbackResponse,
  SubmitTicketFeedbackBody,
  SubmitTicketFeedbackParams,
} from "@workspace/api-zod";
import { db, ticketFeedbackTable, ticketsTable, type TicketFeedback } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { writeAuditLog } from "../lib/tickets";

const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toFeedback(row: TicketFeedback) {
  return {
    id: row.id,
    ticketId: row.ticketId,
    rating: row.rating,
    comment: row.comment ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/tickets/:ticketId/feedback", requireAuth, async (req, res): Promise<void> => {
  const params = GetTicketFeedbackParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.ticketId)) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  const user = req.authUser!;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, params.data.ticketId));
  const hidden =
    !ticket ||
    (user.role === "requester" && ticket.requesterId !== user.id) ||
    (user.role === "agent" && ticket.assignedAgentId !== null && ticket.assignedAgentId !== user.id);
  if (hidden) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  const [row] = await db.select().from(ticketFeedbackTable).where(eq(ticketFeedbackTable.ticketId, ticket.id));
  res.json(GetTicketFeedbackResponse.parse({ feedback: row ? toFeedback(row) : null }));
});

router.post("/tickets/:ticketId/feedback", requireAuth, async (req, res): Promise<void> => {
  const params = SubmitTicketFeedbackParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.ticketId)) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  const body = SubmitTicketFeedbackBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = req.authUser!;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, params.data.ticketId));
  if (!ticket || (user.role === "requester" && ticket.requesterId !== user.id)) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  if (user.role !== "requester") {
    res.status(403).json({ error: "Only the requester can rate a ticket." });
    return;
  }
  if (ticket.status !== "resolved" && ticket.status !== "closed") {
    res.status(409).json({ error: "You can rate a ticket once it has been resolved." });
    return;
  }

  const [saved] = await db
    .insert(ticketFeedbackTable)
    .values({
      ticketId: ticket.id,
      requesterId: user.id,
      rating: body.data.rating,
      comment: body.data.comment?.trim() || null,
    })
    .onConflictDoNothing({ target: ticketFeedbackTable.ticketId })
    .returning();
  if (!saved) {
    res.status(409).json({ error: "You have already rated this ticket." });
    return;
  }

  await writeAuditLog({
    actorId: user.id,
    ticketId: ticket.id,
    action: "ticket.feedback_submitted",
    details: { rating: saved.rating },
  });
  res.status(201).json(toFeedback(saved));
});

export default router;