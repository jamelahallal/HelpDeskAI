import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { hash } from "bcryptjs";
import { getTableName, sql } from "drizzle-orm";
import app from "../app";
import { db, pool, usersTable, type User } from "@workspace/db";
import { issueSessionToken } from "../middlewares/auth";

// Safety net: these helpers wipe tables, so they must never touch a real database.
if (!/helpdesk_test/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Refusing to run tests: DATABASE_URL must point at the helpdesk_test database.");
}

export async function startServer(): Promise<{ base: string; stop: () => Promise<void> }> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
    },
  };
}

export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE "${getTableName(usersTable)}" RESTART IDENTITY CASCADE`));
}

let counter = 0;
export async function createUser(role: User["role"], overrides: Partial<typeof usersTable.$inferInsert> = {}): Promise<User> {
  counter += 1;
  const [user] = await db
    .insert(usersTable)
    .values({
      fullName: `Test ${role} ${counter}`,
      email: `${role}${counter}@test.local`,
      passwordHash: await hash("correct-horse-battery", 4),
      role,
      ...overrides,
    })
    .returning();
  return user!;
}

/** A ready-to-send Cookie header for a user, without going through the rate-limited login route. */
export async function cookieFor(user: User): Promise<string> {
  return `helpdesk_session=${await issueSessionToken(user.id)}`;
}

export async function request(
  base: string,
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
      ...opts.headers,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  return { status: res.status, body, headers: res.headers };
}

export const validTicket = {
  title: "Printer on floor 2 is jammed",
  description: "The shared printer shows a paper jam error and nothing prints.",
  category: "Hardware",
  priority: "P3",
};