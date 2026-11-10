import { Router, type IRouter } from "express";
import { eq, getTableColumns, sql } from "drizzle-orm";
import {
  AdminCreateKbArticleBody,
  AdminCreateKbArticleResponse,
  AdminUpdateKbArticleBody,
  AdminUpdateKbArticleParams,
  AdminUpdateKbArticleResponse,
  ListKbArticlesResponse,
} from "@workspace/api-zod";
import { db, kbArticlesTable } from "@workspace/db";
import { requireAuth, requireRoles } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { embedTexts } from "./tickets";

const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Everything except the 384-number embedding column, which the API never returns.
const { embedding: _embedding, ...publicColumns } = getTableColumns(kbArticlesTable);
type ArticleRow = { id: string; title: string; body: string; category: string; isPublished: boolean; createdAt: Date; updatedAt: Date };

function toArticle(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Must match how backfillArticleEmbeddings() builds its input, or search quality drifts. */
const embeddingText = (article: { title: string; body: string }) => `${article.title}\n${article.body}`;

async function tryEmbed(article: { title: string; body: string }): Promise<number[] | null> {
  try {
    const [vector] = await embedTexts([embeddingText(article)]);
    return vector && vector.length === 384 ? vector : null;
  } catch (err) {
    logger.warn({ err }, "Could not embed knowledge-base article");
    return null;
  }
}

router.get("/kb/articles", requireAuth, async (req, res): Promise<void> => {
  const isAdmin = req.authUser!.role === "admin";
  const rows = await db
    .select(publicColumns)
    .from(kbArticlesTable)
    .where(isAdmin ? undefined : eq(kbArticlesTable.isPublished, true))
    .orderBy(kbArticlesTable.category, kbArticlesTable.title)
    .limit(500);
  res.json(ListKbArticlesResponse.parse(rows.map(toArticle)));
});

router.post("/admin/kb-articles", requireAuth, requireRoles("admin"), async (req, res): Promise<void> => {
  const body = AdminCreateKbArticleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const title = body.data.title.trim();
  const text = body.data.body.trim();
  const category = body.data.category.trim();
  if (!title || !text || !category) {
    res.status(400).json({ error: "Title, category and text cannot be blank." });
    return;
  }

  const embedding = await tryEmbed({ title, body: text });
  const [row] = await db
    .insert(kbArticlesTable)
    .values({ title, body: text, category, isPublished: body.data.isPublished ?? true, embedding })
    .returning(publicColumns);
  res.status(201).json(AdminCreateKbArticleResponse.parse({ article: toArticle(row!), embedded: embedding !== null }));
});

router.patch("/admin/kb-articles/:articleId", requireAuth, requireRoles("admin"), async (req, res): Promise<void> => {
  const params = AdminUpdateKbArticleParams.safeParse(req.params);
  if (!params.success || !uuidPattern.test(params.data.articleId)) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const body = AdminUpdateKbArticleBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.values(body.data).every((value) => value === undefined)) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }

  const [current] = await db
    .select({ ...publicColumns, hasEmbedding: sql<boolean>`${kbArticlesTable.embedding} is not null` })
    .from(kbArticlesTable)
    .where(eq(kbArticlesTable.id, params.data.articleId));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }

  const next = {
    title: body.data.title?.trim() ?? current.title,
    body: body.data.body?.trim() ?? current.body,
    category: body.data.category?.trim() ?? current.category,
    isPublished: body.data.isPublished ?? current.isPublished,
  };
  if (!next.title || !next.body || !next.category) {
    res.status(400).json({ error: "Title, category and text cannot be blank." });
    return;
  }

  const patch: Partial<typeof kbArticlesTable.$inferInsert> = { ...next };
  let embedded = current.hasEmbedding;
  // Re-embed when the wording changed, or when an earlier attempt left the article without an embedding.
  if (next.title !== current.title || next.body !== current.body || !current.hasEmbedding) {
    const embedding = await tryEmbed(next);
    patch.embedding = embedding;
    embedded = embedding !== null;
  }

  const [row] = await db
    .update(kbArticlesTable)
    .set(patch)
    .where(eq(kbArticlesTable.id, current.id))
    .returning(publicColumns);
  res.json(AdminUpdateKbArticleResponse.parse({ article: toArticle(row!), embedded }));
});

export default router;