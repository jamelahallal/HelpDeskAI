import { pgTable, uuid, varchar, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";

export const automationLogsTable = pgTable(
  "automation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflow: varchar("workflow", { length: 80 }).notNull(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    ticketId: uuid("ticket_id").references(() => ticketsTable.id, { onDelete: "set null" }),
    status: varchar("status", { length: 20 }).notNull(), // 'success' | 'failure'
    errorSummary: text("error_summary"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("automation_logs_workflow_event_uidx").on(t.workflow, t.eventId),
    index("automation_logs_created_idx").on(t.createdAt),
  ],
);