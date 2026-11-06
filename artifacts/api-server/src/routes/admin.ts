import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, notInArray, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import {
  AdminCreateUserBody,
  AdminListAutomationLogsQueryParams,
  AdminListAutomationLogsResponse,
  AdminListSlaRulesResponse,
  AdminListUsersResponse,
  AdminUpdateSlaRuleBody,
  AdminUpdateSlaRuleParams,
  AdminUpdateSlaRuleResponse,
  AdminUpdateUserBody,
  AdminUpdateUserParams,
} from "@workspace/api-zod";
import { automationLogsTable, db, slaRulesTable, ticketsTable, usersTable, type User } from "@workspace/db";
import { requireAuth, requireRoles } from "../middlewares/auth";
import { toPublicUser, writeAuditLog } from "../lib/tickets";
import { defaultSlaHours, type TicketPriority } from "../lib/ticket-rules";
import {
  SLA_PRIORITIES,
  userChangeProblem,
  validateSlaHours,
} from "../lib/admin-rules";

const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every /admin route requires a signed-in admin.
router.use("/admin", requireAuth, requireRoles("admin"));

function toManagedUser(user: User) {
  return {
    ...toPublicUser(user),
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(AdminListUsersResponse.parse(users.map(toManagedUser)));
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const parsed = AdminCreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hash(parsed.data.password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      fullName: parsed.data.fullName.trim(),
      email,
      passwordHash,
      role: parsed.data.role,
    })
    .onConflictDoNothing({ target: usersTable.email })
    .returning();

  if (!user) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  await writeAuditLog({
    actorId: req.authUser!.id,
    action: "user.created",
    details: { userId: user.id, email: user.email, role: user.role },
  });
  res.status(201).json(AdminListUsersResponse.element.parse(toManagedUser(user)));
});

router.patch("/admin/users/:userId", async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.userId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const body = AdminUpdateUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const changes = body.data;
  if (
    changes.fullName === undefined &&
    changes.role === undefined &&
    changes.isActive === undefined &&
    changes.password === undefined
  ) {
    res.status(400).json({ error: "Provide at least one field to change." });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const [{ openTickets } = { openTickets: 0 }] = await db
    .select({ openTickets: count() })
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.assignedAgentId, target.id),
        notInArray(ticketsTable.status, ["resolved", "closed"]),
      ),
    );

  const problem = userChangeProblem({
    actorId: req.authUser!.id,
    target: { id: target.id, role: target.role, isActive: target.isActive },
    changes: { role: changes.role, isActive: changes.isActive },
    openAssignedTickets: Number(openTickets),
  });
  if (problem) {
    res.status(409).json({ error: problem });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (changes.fullName !== undefined) updates.fullName = changes.fullName.trim();
  if (changes.role !== undefined) updates.role = changes.role;
  if (changes.isActive !== undefined) updates.isActive = changes.isActive;
  if (changes.password !== undefined) updates.passwordHash = await hash(changes.password, 12);

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, target.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  // Never log the password itself, only that it was reset.
  await writeAuditLog({
    actorId: req.authUser!.id,
    action: "user.updated",
    details: {
      userId: target.id,
      ...(changes.fullName !== undefined && { fullName: { from: target.fullName, to: updated.fullName } }),
      ...(changes.role !== undefined && { role: { from: target.role, to: updated.role } }),
      ...(changes.isActive !== undefined && { isActive: { from: target.isActive, to: updated.isActive } }),
      ...(changes.password !== undefined && { passwordReset: true }),
    },
  });
  res.json(AdminListUsersResponse.element.parse(toManagedUser(updated)));
});

async function currentSlaRules() {
  const rows = await db.select().from(slaRulesTable);
  return SLA_PRIORITIES.map((priority) => {
    const row = rows.find((rule) => rule.priority === priority);
    return {
      priority,
      responseHours: row?.responseHours ?? defaultSlaHours[priority],
      ...(row && { updatedAt: row.updatedAt.toISOString() }),
    };
  });
}

router.get("/admin/sla-rules", async (_req, res): Promise<void> => {
  res.json(AdminListSlaRulesResponse.parse(await currentSlaRules()));
});

router.put("/admin/sla-rules/:priority", async (req, res): Promise<void> => {
  const params = AdminUpdateSlaRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Priority not found." });
    return;
  }
  const body = AdminUpdateSlaRuleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const priority: TicketPriority = params.data.priority;
  const current = await currentSlaRules();
  const proposed = Object.fromEntries(
    current.map((rule) => [
      rule.priority,
      rule.priority === priority ? body.data.responseHours : rule.responseHours,
    ]),
  ) as Record<TicketPriority, number>;

  const problem = validateSlaHours(proposed);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }

  const previous = current.find((rule) => rule.priority === priority)!.responseHours;
  const [saved] = await db
    .insert(slaRulesTable)
    .values({ priority, responseHours: body.data.responseHours })
    .onConflictDoUpdate({
      target: slaRulesTable.priority,
      set: { responseHours: body.data.responseHours, updatedAt: new Date() },
    })
    .returning();

  await writeAuditLog({
    actorId: req.authUser!.id,
    action: "sla_rule.updated",
    details: { priority, from: previous, to: body.data.responseHours },
  });
  res.json(
    AdminUpdateSlaRuleResponse.parse({
      priority: saved!.priority,
      responseHours: saved!.responseHours,
      updatedAt: saved!.updatedAt.toISOString(),
    }),
  );
});

const AUTOMATION_WORKFLOWS = ["new-ticket", "sla-warning", "resolution-followup", "p1-escalation"];

router.get("/admin/automation-logs", async (req, res): Promise<void> => {
  const query = AdminListAutomationLogsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { status, workflow, limit } = query.data;

  const conditions = [];
  if (status) conditions.push(eq(automationLogsTable.status, status));
  if (workflow) conditions.push(eq(automationLogsTable.workflow, workflow));

  const [rows, counts] = await Promise.all([
    db
      .select({ log: automationLogsTable, ticketTitle: ticketsTable.title })
      .from(automationLogsTable)
      .leftJoin(ticketsTable, eq(automationLogsTable.ticketId, ticketsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(automationLogsTable.createdAt))
      .limit(limit ?? 50),
    db
      .select({
        workflow: automationLogsTable.workflow,
        success: sql<number>`count(*) filter (where ${automationLogsTable.status} = 'success')::int`,
        failure: sql<number>`count(*) filter (where ${automationLogsTable.status} = 'failure')::int`,
      })
      .from(automationLogsTable)
      .groupBy(automationLogsTable.workflow),
  ]);

  // Always show the four known workflows, even before they have run.
  const names = Array.from(new Set([...AUTOMATION_WORKFLOWS, ...counts.map((c) => c.workflow)]));
  const summary = names.map((name) => {
    const found = counts.find((c) => c.workflow === name);
    return { workflow: name, success: found?.success ?? 0, failure: found?.failure ?? 0 };
  });

  res.json(
    AdminListAutomationLogsResponse.parse({
      summary,
      logs: rows.map(({ log, ticketTitle }) => ({
        id: log.id,
        workflow: log.workflow,
        eventId: log.eventId,
        ticketId: log.ticketId ?? null,
        ticketTitle: ticketTitle ?? null,
        status: log.status,
        errorSummary: log.errorSummary ?? null,
        startedAt: log.startedAt?.toISOString() ?? null,
        finishedAt: log.finishedAt?.toISOString() ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
    }),
  );
});

export default router;
