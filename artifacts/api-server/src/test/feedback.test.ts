import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { User } from "@workspace/db";
import { cookieFor, createUser, request, resetDb, startServer, validTicket } from "./helpers";

describe("satisfaction feedback", () => {
  let base = "";
  let stop: () => Promise<void>;
  let requester: User, other: User, agent: User;
  let requesterCookie = "", otherCookie = "", agentCookie = "";

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    requester = await createUser("requester");
    other = await createUser("requester");
    agent = await createUser("agent");
    [requesterCookie, otherCookie, agentCookie] = await Promise.all([cookieFor(requester), cookieFor(other), cookieFor(agent)]);
  });
  after(async () => { await stop(); });

  const newTicket = async () => (await request(base, "POST", "/tickets", { cookie: requesterCookie, body: validTicket })).body.id as string;
  const resolve = async (id: string) => {
    await request(base, "PATCH", `/tickets/${id}/assignment`, { cookie: agentCookie, body: { agentId: agent.id } });
    await request(base, "PATCH", `/tickets/${id}/status`, { cookie: agentCookie, body: { status: "in_progress" } });
    const done = await request(base, "PATCH", `/tickets/${id}/status`, { cookie: agentCookie, body: { status: "resolved" } });
    assert.equal(done.status, 200);
  };
  const rate = (id: string, body: object, cookie = requesterCookie) =>
    request(base, "POST", `/tickets/${id}/feedback`, { cookie, body });

  it("lets the requester rate a resolved ticket once", async () => {
    const id = await newTicket();
    await resolve(id);
    const first = await rate(id, { rating: 5, comment: "  Fast and friendly  " });
    assert.equal(first.status, 201);
    assert.equal(first.body.rating, 5);
    assert.equal(first.body.comment, "Fast and friendly");
    assert.equal((await rate(id, { rating: 1 })).status, 409);

    const read = await request(base, "GET", `/tickets/${id}/feedback`, { cookie: agentCookie });
    assert.equal(read.status, 200);
    assert.equal(read.body.feedback.rating, 5);
  });

  it("returns null feedback before anyone has rated", async () => {
    const id = await newTicket();
    const res = await request(base, "GET", `/tickets/${id}/feedback`, { cookie: requesterCookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.feedback, null);
  });

  it("refuses a rating before the ticket is resolved", async () => {
    const id = await newTicket();
    assert.equal((await rate(id, { rating: 4 })).status, 409);
  });

  it("rejects ratings outside 1 to 5", async () => {
    const id = await newTicket();
    await resolve(id);
    assert.equal((await rate(id, { rating: 0 })).status, 400);
    assert.equal((await rate(id, { rating: 6 })).status, 400);
    assert.equal((await rate(id, { rating: 3.5 })).status, 400);
  });

  it("only lets the ticket's own requester rate it", async () => {
    const id = await newTicket();
    await resolve(id);
    assert.equal((await rate(id, { rating: 5 }, otherCookie)).status, 404);
    assert.equal((await rate(id, { rating: 5 }, agentCookie)).status, 403);
  });

  it("requires sign-in", async () => {
    const id = await newTicket();
    assert.equal((await request(base, "POST", `/tickets/${id}/feedback`, { body: { rating: 5 } })).status, 401);
  });
});