import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { User } from "@workspace/db";
import { cookieFor, createUser, request, resetDb, startServer, validTicket } from "./helpers";
import { allowedOrigins } from "../middlewares/csrf";

describe("origin check (CSRF)", () => {
  let base = "";
  let stop: () => Promise<void>;
  let requester: User;
  let cookie = "";

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    requester = await createUser("requester");
    cookie = await cookieFor(requester);
  });
  after(async () => { await stop(); });

  const create = (headers?: Record<string, string>) =>
    request(base, "POST", "/tickets", { cookie, body: validTicket, headers });

  it("rejects an unsafe request from a foreign origin", async () => {
    const res = await create({ origin: "https://evil.example" });
    assert.equal(res.status, 403);
  });

  it("rejects the opaque 'null' origin", async () => {
    assert.equal((await create({ origin: "null" })).status, 403);
  });

  it("rejects a foreign origin even without a session (login CSRF)", async () => {
    const res = await request(base, "POST", "/auth/login", {
      body: { email: requester.email, password: "correct-horse-battery" },
      headers: { origin: "https://evil.example" },
    });
    assert.equal(res.status, 403);
  });

  it("allows an unsafe request with no Origin header (non-browser clients)", async () => {
    assert.equal((await create()).status, 201);
  });

  it("allows reads from any origin", async () => {
    const res = await request(base, "GET", "/auth/me", { cookie, headers: { origin: "https://evil.example" } });
    assert.equal(res.status, 200);
  });

  it("allows the configured origin", { skip: allowedOrigins.size === 0 && "CORS_ORIGIN is not set in .env.test" }, async () => {
    const [origin] = [...allowedOrigins];
    assert.equal((await create({ origin: origin! })).status, 201);
  });
});