import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, passwordResetTokensTable } from "@workspace/db";
import { createUser, request, resetDb, startServer } from "./helpers";
import { setMailTransport, type Mail } from "../lib/mail";

const GENERIC = "If an account exists for that email, a reset link has been sent.";
const NEW_PASSWORD = "a-brand-new-passphrase";

describe("password reset", () => {
  let base = "";
  let stop: () => Promise<void>;
  let outbox: Mail[] = [];

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    setMailTransport(async (mail) => { outbox.push(mail); });
  });
  after(async () => {
    setMailTransport(null);
    await stop();
  });
  beforeEach(() => { outbox = []; });

  const forgot = (email: string) => request(base, "POST", "/auth/forgot-password", { body: { email } });
  const reset = (token: string, password: string) =>
    request(base, "POST", "/auth/reset-password", { body: { token, password } });
  const login = (email: string, password: string) =>
    request(base, "POST", "/auth/login", { body: { email, password } });
  const tokenFrom = (mail: Mail | undefined): string => {
    const match = mail ? /token=([\w-]+)/.exec(mail.text) : null;
    assert.ok(match, "reset email should contain a token link");
    return match[1]!;
  };

  it("emails a link and lets the user set a new password", async () => {
    const user = await createUser("requester");
    const res = await forgot(user.email);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, GENERIC);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0]!.to, user.email);

    const token = tokenFrom(outbox[0]);
    assert.equal((await reset(token, "short")).status, 400);
    assert.equal((await reset(token, NEW_PASSWORD)).status, 200);
    assert.equal((await login(user.email, NEW_PASSWORD)).status, 200);
    assert.equal((await login(user.email, "correct-horse-battery")).status, 401);
  });

  it("accepts a token only once", async () => {
    const user = await createUser("requester");
    await forgot(user.email);
    const token = tokenFrom(outbox[0]);
    assert.equal((await reset(token, NEW_PASSWORD)).status, 200);
    assert.equal((await reset(token, "another-new-passphrase")).status, 400);
  });

  it("answers identically for an unknown email and sends nothing", async () => {
    const res = await forgot("nobody@test.local");
    assert.equal(res.status, 200);
    assert.equal(res.body.message, GENERIC);
    assert.equal(outbox.length, 0);
  });

  it("sends nothing to a deactivated account", async () => {
    const user = await createUser("requester", { isActive: false });
    const res = await forgot(user.email);
    assert.equal(res.status, 200);
    assert.equal(outbox.length, 0);
  });

  it("rejects an expired token", async () => {
    const user = await createUser("requester");
    await forgot(user.email);
    const token = tokenFrom(outbox[0]);
    await db
      .update(passwordResetTokensTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(passwordResetTokensTable.userId, user.id));
    assert.equal((await reset(token, NEW_PASSWORD)).status, 400);
  });

  it("invalidates an older link when a newer one is requested", async () => {
    const user = await createUser("requester");
    await forgot(user.email);
    await forgot(user.email);
    assert.equal(outbox.length, 2);
    const [older, newer] = [tokenFrom(outbox[0]), tokenFrom(outbox[1])];
    assert.equal((await reset(older, NEW_PASSWORD)).status, 400);
    assert.equal((await reset(newer, NEW_PASSWORD)).status, 200);
  });

  it("rejects a token that was never issued", async () => {
    assert.equal((await reset("x".repeat(43), NEW_PASSWORD)).status, 400);
  });
});