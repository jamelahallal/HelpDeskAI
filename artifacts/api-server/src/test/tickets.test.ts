import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { User } from "@workspace/db";
import { cookieFor, createUser, request, resetDb, startServer, validTicket } from "./helpers";

describe("ticket creation, assignment and status", () => {
  let base = "";
  let stop: () => Promise<void>;
  let requester: User, agent: User, otherAgent: User, admin: User;
  let requesterCookie = "", agentCookie = "", adminCookie = "";

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    requester = await createUser("requester");
    agent = await createUser("agent");
    otherAgent = await createUser("agent");
    admin = await createUser("admin");
    [requesterCookie, agentCookie, adminCookie] = await Promise.all([cookieFor(requester), cookieFor(agent), cookieFor(admin)]);
  });
  after(async () => { await stop(); });

  const create = (body: object = validTicket) => request(base, "POST", "/tickets", { cookie: requesterCookie, body });

  describe("creation", () => {
    it("creates a ticket owned by the requester, starting as new with an SLA deadline", async () => {
      const res = await create({ ...validTicket, priority: "P1" });
      assert.equal(res.status, 201);
      assert.equal(res.body.status, "new");
      assert.equal(res.body.priority, "P1");
      assert.equal(res.body.requester.id, requester.id);
      assert.equal(res.body.assignedAgent, null);
      const hours = (Date.parse(res.body.slaDeadline) - Date.parse(res.body.createdAt)) / 3_600_000;
      assert.ok(Math.abs(hours - 1) < 0.05, `P1 should allow 1 hour, got ${hours}`);
    });

    it("rejects missing or too-short fields with 400", async () => {
      assert.equal((await create({ ...validTicket, title: "hi" })).status, 400);
      assert.equal((await create({ ...validTicket, description: "short" })).status, 400);
      assert.equal((await create({ title: validTicket.title })).status, 400);
    });

    it("rejects an invalid priority", async () => {
      assert.equal((await create({ ...validTicket, priority: "P9" })).status, 400);
    });

    it("requires a session", async () => {
      assert.equal((await request(base, "POST", "/tickets", { body: validTicket })).status, 401);
    });
  });

  describe("assignment", () => {
    it("lets an agent take an unassigned ticket", async () => {
      const t = (await create()).body;
      const res = await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: agentCookie, body: { agentId: agent.id } });
      assert.equal(res.status, 200);
      assert.equal(res.body.assignedAgent.id, agent.id);
    });

    it("lets an admin assign to any agent", async () => {
      const t = (await create()).body;
      const res = await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: adminCookie, body: { agentId: otherAgent.id } });
      assert.equal(res.status, 200);
      assert.equal(res.body.assignedAgent.id, otherAgent.id);
    });

    it("refuses to assign a ticket to a requester", async () => {
      const t = (await create()).body;
      const res = await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: adminCookie, body: { agentId: requester.id } });
      assert.ok(res.status >= 400 && res.status < 500, `expected a 4xx, got ${res.status}`);
    });

    it("lets an agent release a ticket they own", async () => {
      const t = (await create()).body;
      await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: agentCookie, body: { agentId: agent.id } });
      const res = await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: agentCookie, body: { agentId: null } });
      assert.equal(res.status, 200);
      assert.equal(res.body.assignedAgent, null);
    });

    it("returns 404 for an unknown ticket", async () => {
      const res = await request(base, "PATCH", "/tickets/00000000-0000-4000-8000-000000000000/assignment", { cookie: adminCookie, body: { agentId: agent.id } });
      assert.equal(res.status, 404);
    });
  });

  describe("status lifecycle", () => {
    it("moves new → assigned → in_progress → resolved, then the requester closes it", async () => {
      const t = (await create()).body;
      await request(base, "PATCH", `/tickets/${t.id}/assignment`, { cookie: agentCookie, body: { agentId: agent.id } });
      for (const status of ["assigned", "in_progress", "resolved"]) {
        const res = await request(base, "PATCH", `/tickets/${t.id}/status`, { cookie: agentCookie, body: { status } });
        // The assignment step may already have moved the ticket to "assigned".
        if (status === "assigned" && res.status === 409) continue;
        assert.equal(res.status, 200, `→ ${status}`);
        assert.equal(res.body.status, status);
      }
      const closed = await request(base, "PATCH", `/tickets/${t.id}/status`, { cookie: requesterCookie, body: { status: "closed" } });
      assert.equal(closed.status, 200);
      assert.equal(closed.body.status, "closed");
    });

    it("rejects skipping a step with 409", async () => {
      const t = (await create()).body;
      const res = await request(base, "PATCH", `/tickets/${t.id}/status`, { cookie: agentCookie, body: { status: "resolved" } });
      assert.equal(res.status, 409);
    });

    it("does not let a requester close a ticket that is not resolved yet", async () => {
      const t = (await create()).body;
      const res = await request(base, "PATCH", `/tickets/${t.id}/status`, { cookie: requesterCookie, body: { status: "closed" } });
      assert.ok([403, 409].includes(res.status), `expected 403 or 409, got ${res.status}`);
    });
  });
});