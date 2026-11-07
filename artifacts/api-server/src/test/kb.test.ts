import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db, kbArticlesTable } from "@workspace/db";
import { cookieFor, createUser, request, resetDb, startServer } from "./helpers";

const article = {
  title: "Reset a forgotten password",
  body: "Open the sign-in page and choose Forgot password to receive a reset link.",
  category: "Accounts",
};

describe("knowledge base", () => {
  let base = "";
  let stop: () => Promise<void>;
  let adminCookie = "", requesterCookie = "";

  before(async () => {
    ({ base, stop } = await startServer());
    await resetDb();
    await db.delete(kbArticlesTable); // test database only; helpers refuse any other
    const [admin, requester] = [await createUser("admin"), await createUser("requester")];
    [adminCookie, requesterCookie] = await Promise.all([cookieFor(admin), cookieFor(requester)]);
  });
  after(async () => { await stop(); });

  const create = (body: object, cookie = adminCookie) =>
    request(base, "POST", "/admin/kb-articles", { cookie, body });
  const list = (cookie: string) => request(base, "GET", "/kb/articles", { cookie });

  it("lets only admins create articles", async () => {
    assert.equal((await create(article, requesterCookie)).status, 403);
    assert.equal((await request(base, "POST", "/admin/kb-articles", { body: article })).status, 401);
    const ok = await create(article);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.article.title, article.title);
    assert.equal(ok.body.article.isPublished, true);
    assert.equal(typeof ok.body.embedded, "boolean"); // false here: the test AI service is unreachable
  });

  it("rejects invalid input", async () => {
    assert.equal((await create({ ...article, title: "ab" })).status, 400);
    assert.equal((await create({ ...article, body: "short" })).status, 400);
    assert.equal((await create({ title: "No category here", body: article.body })).status, 400);
  });

  it("requires sign-in to read", async () => {
    assert.equal((await request(base, "GET", "/kb/articles")).status, 401);
  });

  it("shows unpublished articles to admins only", async () => {
    const draft = await create({ ...article, title: "Draft: VPN setup guide", isPublished: false });
    assert.equal(draft.status, 201);
    const id = draft.body.article.id as string;

    const asRequester = await list(requesterCookie);
    assert.equal(asRequester.status, 200);
    assert.ok(!asRequester.body.some((a: { id: string }) => a.id === id));
    assert.ok(asRequester.body.every((a: { isPublished: boolean }) => a.isPublished));

    const asAdmin = await list(adminCookie);
    assert.ok(asAdmin.body.some((a: { id: string }) => a.id === id));
  });

  it("edits and unpublishes an article", async () => {
    const created = await create({ ...article, title: "Printer offline checklist" });
    const id = created.body.article.id as string;
    const patch = (body: object, target = id, cookie = adminCookie) =>
      request(base, "PATCH", `/admin/kb-articles/${target}`, { cookie, body });

    const edited = await patch({ title: "Printer offline: full checklist" });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.article.title, "Printer offline: full checklist");

    assert.equal((await patch({ isPublished: false })).status, 200);
    const asRequester = await list(requesterCookie);
    assert.ok(!asRequester.body.some((a: { id: string }) => a.id === id));

    assert.equal((await patch({})).status, 400);
    assert.equal((await patch({ title: "ab" })).status, 400);
    assert.equal((await patch({ title: "Valid title" }, "00000000-0000-4000-8000-000000000000")).status, 404);
    assert.equal((await patch({ title: "Valid title" }, "not-a-uuid")).status, 404);
    assert.equal((await patch({ title: "Valid title" }, id, requesterCookie)).status, 403);
  });
});