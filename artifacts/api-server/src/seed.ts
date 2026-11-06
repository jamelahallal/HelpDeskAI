import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import {
  auditLogsTable,
  db,
  pool,
  slaRulesTable,
  ticketAssignmentsTable,
  ticketCommentsTable,
  ticketsTable,
  usersTable,
  type User,
} from "@workspace/db";
import { logger } from "./lib/logger";

const demoPassword = process.env.DEMO_PASSWORD ?? "HelpdeskDemo26!";

async function getOrCreateUser(input: {
  fullName: string;
  email: string;
  role: User["role"];
}): Promise<User> {
  const email = input.email.toLowerCase();
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) return existing;

  const [created] = await db
    .insert(usersTable)
    .values({
      fullName: input.fullName,
      email,
      role: input.role,
      passwordHash: await hash(demoPassword, 12),
    })
    .returning();
  if (!created) throw new Error(`Could not seed user ${email}`);
  return created;
}

async function createDemoTicket(input: {
  title: string;
  description: string;
  category: string;
  priority: "P1" | "P2" | "P3" | "P4";
  status: "new" | "assigned" | "in_progress";
  requester: User;
  agent?: User;
  createdMinutesAgo: number;
  slaHours: number;
}) {
  const [existing] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.title, input.title))
    .limit(1);
  if (existing) return existing;

  const createdAt = new Date(Date.now() - input.createdMinutesAgo * 60_000);
  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: input.status,
      requesterId: input.requester.id,
      assignedAgentId: input.agent?.id ?? null,
      createdAt,
      updatedAt: createdAt,
      slaDeadline: new Date(createdAt.getTime() + input.slaHours * 60 * 60_000),
    })
    .returning();
  if (!ticket) throw new Error(`Could not seed ticket: ${input.title}`);

  if (input.agent) {
    await db.insert(ticketAssignmentsTable).values({
      ticketId: ticket.id,
      agentId: input.agent.id,
      assignedById: input.agent.id,
      assignedAt: createdAt,
    });
  }
  await db.insert(auditLogsTable).values({
    actorId: input.requester.id,
    ticketId: ticket.id,
    action: "ticket.created",
    details: { seeded: true },
    createdAt,
  });
  return ticket;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed data is disabled in production.");
  }
  if (demoPassword.length < 10) {
    throw new Error("DEMO_PASSWORD must contain at least 10 characters.");
  }

  const [requester, agent, admin] = await Promise.all([
    getOrCreateUser({
      fullName: "Avery Morgan",
      email: "requester@helpdesk.local",
      role: "requester",
    }),
    getOrCreateUser({
      fullName: "Jordan Lee",
      email: "agent@helpdesk.local",
      role: "agent",
    }),
    getOrCreateUser({
      fullName: "Morgan Chen",
      email: "admin@helpdesk.local",
      role: "admin",
    }),
  ]);

  await db
    .insert(slaRulesTable)
    .values([
      { priority: "P1", responseHours: 1 },
      { priority: "P2", responseHours: 4 },
      { priority: "P3", responseHours: 8 },
      { priority: "P4", responseHours: 24 },
    ])
    .onConflictDoNothing();

  const vpnTicket = await createDemoTicket({
    title: "VPN access is unavailable",
    description: "I cannot connect to the company VPN from home. The client returns a connection timeout after MFA.",
    category: "Network",
    priority: "P1",
    status: "assigned",
    requester,
    agent,
    createdMinutesAgo: 48,
    slaHours: 1,
  });
  const shareTicket = await createDemoTicket({
    title: "Finance shared drive permission",
    description: "The finance shared drive says I do not have permission, although I need access for the monthly close.",
    category: "Access",
    priority: "P2",
    status: "in_progress",
    requester,
    agent,
    createdMinutesAgo: 82,
    slaHours: 4,
  });
  const cameraTicket = await createDemoTicket({
    title: "Laptop camera not detected",
    description: "Video calls cannot find the built-in camera after this morning's system update.",
    category: "Hardware",
    priority: "P4",
    status: "new",
    requester,
    createdMinutesAgo: 24,
    slaHours: 24,
  });

  const [existingComment] = await db
    .select({ id: ticketCommentsTable.id })
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.ticketId, vpnTicket.id))
    .limit(1);
  if (!existingComment) {
    await db.insert(ticketCommentsTable).values([
      {
        ticketId: vpnTicket.id,
        authorId: requester.id,
        body: "The issue started after I changed my MFA device.",
        isInternal: false,
      },
      {
        ticketId: vpnTicket.id,
        authorId: agent.id,
        body: "Checking the VPN gateway logs and MFA enrollment.",
        isInternal: true,
      },
    ]);
  }

  logger.info(
    { seededTickets: [vpnTicket.id, shareTicket.id, cameraTicket.id] },
    "HelpDeskAI demo data is ready",
  );
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Demo data seeding failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
