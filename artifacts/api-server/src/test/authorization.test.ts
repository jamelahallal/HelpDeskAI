import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { User } from "@workspace/db";
import { cookieFor, createUser, request, resetDb, startServer, validTicket } from "./helpers";

describe("authorization", () => {
  let base = "";
  let stop: () => Promise<void>;
  let requester: User, otherRequester: User, agent: User, admin: User;
  let requesterCookie = "", otherCookie = "", agentCookie = "", adminCookie = "";
  let ticketId = "";

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    requester = await createUser("requester");
    otherRequester = await createUser("requester");
    agent = await createUser("agent");
    admin = await createUser("admin");
    [requesterCookie, otherCookie, agentCookie, adminCookie] = await Promise.all([
      cookieFor(requester), cookieFor(otherRequester), cookieFor(agent), cookieFor(admin),
    ]);
    const created = await request(base, "POST", "/tickets", { cookie: requesterCookie, body: validTicket });
    assert.equal(created.status, 201);
    ticketId = created.body.id;
  });
  after(async () => { await stop(); });

  it("requires sign-in for protected routes", async () => {
    for (const path of ["/tickets", "/dashboard/summary", "/admin/users", "/admin/sla-rules", "/admin/automation-logs"]) {
      const res = await request(base, "GET", path);
      assert.equal(res.status, 401, `${path} should need a session`);
    }
  });

  it("limits /admin routes to admins", async () => {
    assert.equal((await request(base, "GET", "/admin/users", { cookie: requesterCookie })).status, 403);
    assert.equal((await request(base, "GET", "/admin/users", { cookie: agentCookie })).status, 403);
    assert.equal((await request(base, "GET", "/admin/automation-logs", { cookie: agentCookie })).status, 403);
    assert.equal((await request(base, "GET", "/admin/users", { cookie: adminCookie })).status, 200);
  });

  it("only lets a requester see their own tickets", async () => {
    const mine = await request(base, "GET", "/tickets", { cookie: requesterCookie });
    assert.equal(mine.body.length, 1);
    const theirs = await request(base, "GET", "/tickets", { cookie: otherCookie });
    assert.equal(theirs.body.length, 0);
    const direct = await request(base, "GET", `/tickets/${ticketId}`, { cookie: otherCookie });
    assert.ok([403, 404].includes(direct.status), `expected 403 or 404, got ${direct.status}`);
  });

    it("stops requesters changing assignment or priority", async () => {
    const assign = await request(base, "PATCH", `/tickets/${ticketId}/assignment`, { cookie: requesterCookie, body: { agentId: agent.id } });
    const priority = await request(base, "PATCH", `/tickets/${ticketId}/priority`, { cookie: requesterCookie, body: { priority: "P1" } });
    assert.equal(assign.status, 403);
    assert.equal(priority.status, 403);
  });

  it("stops a requester moving an assigned ticket forward", async () => {
    // Assigning moves the ticket to "assigned", so in_progress is a valid next step, but not for a requester.
    await request(base, "PATCH", `/tickets/${ticketId}/assignment`, { cookie: agentCookie, body: { agentId: agent.id } });
    const res = await request(base, "PATCH", `/tickets/${ticketId}/status`, { cookie: requesterCookie, body: { status: "in_progress" } });
    assert.equal(res.status, 403);
    const after = await request(base, "GET", `/tickets/${ticketId}`, { cookie: agentCookie });
    assert.equal(after.body.status, "assigned"); // unchanged
  });

  it("protects the automation endpoints with the shared key", async () => {
    assert.equal((await request(base, "GET", "/automation/at-risk-tickets")).status, 401);
    assert.equal((await request(base, "GET", "/automation/at-risk-tickets", { headers: { "x-automation-key": "wrong" } })).status, 401);
    // A normal user session is not a substitute for the key.
    assert.equal((await request(base, "GET", "/automation/at-risk-tickets", { cookie: adminCookie })).status, 401);
    const ok = await request(base, "GET", "/automation/at-risk-tickets", { headers: { "x-automation-key": process.env.AUTOMATION_API_KEY! } });
    assert.equal(ok.status, 200);
  });

  it("stops an admin changing their own role or deactivating themselves", async () => {
    const res = await request(base, "PATCH", `/admin/users/${admin.id}`, { cookie: adminCookie, body: { isActive: false } });
    assert.equal(res.status, 409);
  });
});