import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cookieFor, createUser, request, resetDb, startServer } from "./helpers";

describe("authentication", () => {
  let base = "";
  let stop: () => Promise<void>;

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
  });
  after(async () => { await stop(); });

  it("registers a requester and signs them in", async () => {
    const res = await request(base, "POST", "/auth/register", {
      body: { fullName: "Nora Test", email: "Nora@Test.local", password: "a-long-password-1" },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "requester");
    assert.equal(res.body.user.email, "nora@test.local"); // lowercased
    assert.match(res.headers.getSetCookie().join(";"), /helpdesk_session=/);
    assert.equal(res.body.user.passwordHash, undefined);
  });

  it("rejects a duplicate email with 409", async () => {
    const res = await request(base, "POST", "/auth/register", {
      body: { fullName: "Nora Again", email: "nora@test.local", password: "a-long-password-1" },
    });
    assert.equal(res.status, 409);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(base, "POST", "/auth/register", {
      body: { fullName: "Short Pass", email: "short@test.local", password: "short" },
    });
    assert.equal(res.status, 400);
  });

  it("logs in with the right password", async () => {
    const user = await createUser("agent");
    const res = await request(base, "POST", "/auth/login", {
      body: { email: user.email, password: "correct-horse-battery" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.id, user.id);
  });

  it("rejects a wrong password and an unknown email with the same 401", async () => {
    const user = await createUser("agent");
    const wrong = await request(base, "POST", "/auth/login", { body: { email: user.email, password: "wrong-password-1" } });
    const unknown = await request(base, "POST", "/auth/login", { body: { email: "nobody@test.local", password: "wrong-password-1" } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error); // no account enumeration
  });

  it("blocks a deactivated account from signing in", async () => {
    const user = await createUser("agent", { isActive: false });
    const res = await request(base, "POST", "/auth/login", { body: { email: user.email, password: "correct-horse-battery" } });
    assert.equal(res.status, 401);
  });

  it("returns the current user for a valid session and 401 without one", async () => {
    const user = await createUser("requester");
    const ok = await request(base, "GET", "/auth/me", { cookie: await cookieFor(user) });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.id, user.id);
    const anon = await request(base, "GET", "/auth/me");
    assert.equal(anon.status, 401);
  });

  it("rejects a tampered session token", async () => {
    const res = await request(base, "GET", "/auth/me", { cookie: "helpdesk_session=not.a.real.token" });
    assert.equal(res.status, 401);
  });
});