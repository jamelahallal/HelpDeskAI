import { check, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ticketsTable } from "./tickets";
import { usersTable } from "./users";

export const ticketFeedbackTable = pgTable(
  "ticket_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .unique()
      .references(() => ticketsTable.id, { onDelete: "cascade" }),
    requesterId: uuid("requester_id").notNull().references(() => usersTable.id),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("ticket_feedback_rating_range", sql`${table.rating} between 1 and 5`)],
);

export type TicketFeedback = typeof ticketFeedbackTable.$inferSelect;