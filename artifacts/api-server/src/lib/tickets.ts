import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import {
  auditLogsTable,
  db,
  slaRulesTable,
  ticketCommentsTable,
  ticketsTable,
  usersTable,
  type Ticket,
  type User,
} from "@workspace/db";
import { calculateSla, defaultSlaHours } from "./ticket-rules";


export function toPublicUser(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    initials: user.fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(""),
  };
}

export async function getSlaHours(priority: Ticket["priority"]): Promise<number> {
  const [rule] = await db
    .select({ responseHours: slaRulesTable.responseHours })
    .from(slaRulesTable)
    .where(eq(slaRulesTable.priority, priority));
  return rule?.responseHours ?? defaultSlaHours[priority];
}

export async function makeTicketResponse(
  ticket: Ticket,
  requester: User,
  assignedAgent: User | null,
  commentsCount: number,
) {
  const { slaPercent, slaState } = calculateSla(
    ticket.status,
    ticket.createdAt,
    ticket.slaDeadline,
  );

  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    requester: toPublicUser(requester),
    assignedAgent: assignedAgent ? toPublicUser(assignedAgent) : null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    slaDeadline: ticket.slaDeadline.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    commentsCount,
    slaPercent,
    slaState,
  };
}

export async function getTicketUsers(tickets: Ticket[]) {
  const ids = [...new Set(
    tickets.flatMap((ticket) => [ticket.requesterId, ticket.assignedAgentId].filter((id): id is string => Boolean(id))),
  )];

  if (ids.length === 0) return new Map<string, User>();
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, ids));
  return new Map(users.map((user) => [user.id, user]));
}

export async function getCommentCounts(ticketIds: string[], includeInternal = true) {
  if (ticketIds.length === 0) return new Map<string, number>();
  const where = includeInternal
    ? inArray(ticketCommentsTable.ticketId, ticketIds)
    : and(
        inArray(ticketCommentsTable.ticketId, ticketIds),
        eq(ticketCommentsTable.isInternal, false),
      );
  const counts = await db
    .select({ ticketId: ticketCommentsTable.ticketId, total: count() })
    .from(ticketCommentsTable)
    .where(where)
    .groupBy(ticketCommentsTable.ticketId);
  return new Map(counts.map((row) => [row.ticketId, Number(row.total)]));
}

export async function getVisibleTickets(user: User, options?: {
  status?: Ticket["status"];
  priority?: Ticket["priority"];
  search?: string;
  limit?: number;
}) {
  const conditions: SQL[] = [];
  if (user.role === "requester") {
    conditions.push(eq(ticketsTable.requesterId, user.id));
  } else if (user.role === "agent") {
    conditions.push(or(eq(ticketsTable.assignedAgentId, user.id), isNull(ticketsTable.assignedAgentId))!);
  }
  if (options?.status) conditions.push(eq(ticketsTable.status, options.status));
  if (options?.priority) conditions.push(eq(ticketsTable.priority, options.priority));
  if (options?.search?.trim()) {
    const search = `%${options.search.trim()}%`;
    conditions.push(or(ilike(ticketsTable.title, search), ilike(ticketsTable.description, search))!);
  }

  let query = db.select().from(ticketsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions)!);
  return query.orderBy(desc(ticketsTable.createdAt)).limit(options?.limit ?? 50);
}

export async function writeAuditLog(input: {
  actorId: string;
  ticketId?: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(auditLogsTable).values({
    actorId: input.actorId,
    ticketId: input.ticketId ?? null,
    action: input.action,
    details: input.details ?? {},
  });
}
