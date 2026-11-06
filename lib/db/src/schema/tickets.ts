import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", ["P1", "P2", "P3", "P4"]);

export const ticketsTable = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    priority: ticketPriorityEnum("priority").notNull().default("P3"),
    status: ticketStatusEnum("status").notNull().default("new"),
    requesterId: uuid("requester_id").notNull().references(() => usersTable.id),
    assignedAgentId: uuid("assigned_agent_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
    slaDeadline: timestamp("sla_deadline", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_status_idx").on(table.status),
    index("tickets_priority_idx").on(table.priority),
    index("tickets_requester_idx").on(table.requesterId),
    index("tickets_assigned_agent_idx").on(table.assignedAgentId),
    index("tickets_created_at_idx").on(table.createdAt),
  ],
);

export const ticketCommentsTable = pgTable(
  "ticket_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => usersTable.id),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ticket_comments_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketAssignmentsTable = pgTable(
  "ticket_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => usersTable.id),
    assignedById: uuid("assigned_by_id").notNull().references(() => usersTable.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
  },
  (table) => [
    index("ticket_assignments_ticket_idx").on(table.ticketId, table.assignedAt),
    uniqueIndex("ticket_assignments_active_unique_idx")
      .on(table.ticketId)
      .where(sql`${table.unassignedAt} is null`),
  ],
);

export const slaRulesTable = pgTable("sla_rules", {
  priority: ticketPriorityEnum("priority").primaryKey(),
  responseHours: integer("response_hours").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    ticketId: uuid("ticket_id").references(() => ticketsTable.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});
export const insertTicketCommentSchema = createInsertSchema(ticketCommentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
export type TicketComment = typeof ticketCommentsTable.$inferSelect;
export type TicketAssignment = typeof ticketAssignmentsTable.$inferSelect;
export type SlaRule = typeof slaRulesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
