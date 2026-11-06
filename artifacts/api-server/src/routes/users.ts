import { Router, type IRouter } from "express";
import { ListAgentsResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { requireAuth, requireRoles } from "../middlewares/auth";
import { toPublicUser } from "../lib/tickets";

const router: IRouter = Router();

router.get("/users/agents", requireAuth, requireRoles("agent", "admin"), async (_req, res): Promise<void> => {
  const agents = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.isActive, true))
    .orderBy(asc(usersTable.fullName));
  res.json(ListAgentsResponse.parse(
    agents
      .filter((user) => user.role === "agent" || user.role === "admin")
      .map(toPublicUser),
  ));
});

export default router;
