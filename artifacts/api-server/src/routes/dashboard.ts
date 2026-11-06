import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { getVisibleTickets, makeTicketResponse, getTicketUsers, getCommentCounts } from "../lib/tickets";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const tickets = await getVisibleTickets(req.authUser!, { limit: 100 });
  const [users, commentCounts] = await Promise.all([
    getTicketUsers(tickets),
    getCommentCounts(tickets.map((ticket) => ticket.id), req.authUser!.role !== "requester"),
  ]);
  const serialized = await Promise.all(tickets.flatMap((ticket) => {
    const requester = users.get(ticket.requesterId);
    if (!requester) return [];
    const assignedAgent = ticket.assignedAgentId ? users.get(ticket.assignedAgentId) ?? null : null;
    return [makeTicketResponse(ticket, requester, assignedAgent, commentCounts.get(ticket.id) ?? 0)];
  }));

  const resolvedTickets = tickets.filter((ticket) => ticket.resolvedAt !== null);
  const averageResolutionHours = resolvedTickets.length === 0
    ? 0
    : resolvedTickets.reduce((total, ticket) => {
        return total + (ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()) / 3_600_000;
      }, 0) / resolvedTickets.length;

  const response = {
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed").length,
    assigned: tickets.filter((ticket) => ticket.status === "assigned").length,
    inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length,
    slaWarning: serialized.filter((ticket) => ticket.slaState === "warning").length,
    slaBreached: serialized.filter((ticket) => ticket.slaState === "breached").length,
    averageResolutionHours: Math.round(averageResolutionHours * 10) / 10,
    byPriority: ["P1", "P2", "P3", "P4"].map((priority) => ({
      priority,
      count: tickets.filter((ticket) => ticket.priority === priority).length,
    })),
    byCategory: [...new Set(tickets.map((ticket) => ticket.category))].map((category) => ({
      category,
      count: tickets.filter((ticket) => ticket.category === category).length,
    })),
  };

  res.json(GetDashboardSummaryResponse.parse(response));
});

export default router;
