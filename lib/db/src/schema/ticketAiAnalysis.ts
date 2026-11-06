import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { ticketsTable, ticketPriorityEnum } from "./tickets.js";

export const ticketAiAnalysisTable = pgTable("ticket_ai_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  
  category: varchar("category", { length: 80 }).notNull(),
  priority: ticketPriorityEnum("priority").notNull(),
  urgency: varchar("urgency", { length: 20 }).notNull(),
  summary: text("summary").notNull(),
  suggestedTeam: varchar("suggested_team", { length: 80 }).notNull(),
  suggestedArticleIds: jsonb("suggested_article_ids").$type<string[]>().default([]).notNull(),
  duplicateTicketIds: jsonb("duplicate_ticket_ids").$type<string[]>().default([]).notNull(),
  suggestedReply: text("suggested_reply").notNull(),
  
  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});