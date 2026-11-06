import { and, cosineDistance, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { emitAutomationEvent } from "../lib/automation";
import { logger } from "../lib/logger";
import {
  CreateTicketBody,
  CreateTicketCommentBody,
  CreateTicketCommentParams,
  CreateTicketCommentResponse,
  CreateTicketResponse,
  GetTicketParams,
  GetTicketResponse,
  ListTicketsQueryParams,
  ListTicketsResponse,
  UpdateTicketAssignmentBody,
  UpdateTicketAssignmentParams,
  UpdateTicketAssignmentResponse,
  UpdateTicketPriorityBody,
  UpdateTicketPriorityParams,
  UpdateTicketPriorityResponse,
  UpdateTicketStatusBody,
  UpdateTicketStatusParams,
  UpdateTicketStatusResponse,
} from "@workspace/api-zod";
import {
  auditLogsTable,
  db,
  kbArticlesTable,
  ticketAssignmentsTable,
  ticketAiAnalysisTable,
  ticketCommentsTable,
  ticketsTable,
  usersTable,
  type Ticket,
  type User,
} from "@workspace/db";
import { requireAuth, requireRoles } from "../middlewares/auth";
import {
  getCommentCounts,
  getSlaHours,
  getTicketUsers,
  getVisibleTickets,
  makeTicketResponse,
  toPublicUser,
} from "../lib/tickets";
import {
  canChangeAssignment,
  canManageTicket,
  canReadTicket,
  canTransitionTicket,
  createSlaDeadline,
  statusAfterAssignment,
} from "../lib/ticket-rules";
 
const router: IRouter = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 
function getParamId(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && uuidPattern.test(value) ? value : null;
}
 
async function getReadableTicket(ticketId: string, user: User): Promise<Ticket | null> {
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));
  if (!ticket) return null;
  return canReadTicket({
    role: user.role,
    userId: user.id,
    requesterId: ticket.requesterId,
    assignedAgentId: ticket.assignedAgentId,
  }) ? ticket : null;
}
 
async function getTicketDetailResponse(ticket: Ticket, viewer: User) {
  const userMap = await getTicketUsers([ticket]);
  const requester = userMap.get(ticket.requesterId);
  if (!requester) return null;
  const assignedAgent = ticket.assignedAgentId ? userMap.get(ticket.assignedAgentId) ?? null : null;
  const comments = await db
    .select()
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.ticketId, ticket.id))
    .orderBy(ticketCommentsTable.createdAt);
  const visibleComments = viewer.role === "requester"
    ? comments.filter((comment) => !comment.isInternal)
    : comments;
  const authorIds = [...new Set(visibleComments.map((comment) => comment.authorId))];
  const authors = authorIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, authorIds))
    : [];
  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const base = await makeTicketResponse(ticket, requester, assignedAgent, visibleComments.length);
 
  const [analysis] = viewer.role === "requester"
    ? []
    : await db
        .select()
        .from(ticketAiAnalysisTable)
        .where(eq(ticketAiAnalysisTable.ticketId, ticket.id))
        .orderBy(desc(ticketAiAnalysisTable.createdAt))
        .limit(1);

  const articleIds = analysis?.suggestedArticleIds ?? [];
  const suggestedArticles = articleIds.length
    ? await db
        .select({ id: kbArticlesTable.id, title: kbArticlesTable.title })
        .from(kbArticlesTable)
        .where(inArray(kbArticlesTable.id, articleIds))
    : [];
 
  const parsed = GetTicketResponse.parse({
    ...base,
    comments: visibleComments.flatMap((comment) => {
      const author = authorMap.get(comment.authorId);
      if (!author) return [];
      return [{
        id: comment.id,
        ticketId: comment.ticketId,
        author: toPublicUser(author),
        body: comment.body,
        isInternal: comment.isInternal,
        createdAt: comment.createdAt.toISOString(),
      }];
    }),
  });
 
  return {
    ...parsed,
    aiAnalysis: analysis
      ? {
          category: analysis.category,
          priority: analysis.priority,
          urgency: analysis.urgency,
          summary: analysis.summary,
          suggestedTeam: analysis.suggestedTeam,
          suggestedArticleIds: analysis.suggestedArticleIds,
          suggestedArticles,
          duplicateTicketIds: analysis.duplicateTicketIds,
          suggestedReply: analysis.suggestedReply,
          provider: analysis.provider,
          model: analysis.model,
          createdAt: analysis.createdAt.toISOString(),
        }
      : null,
  };
}
 
// ---------------------------------------------------------------------------
// Knowledge-base retrieval: hybrid = keyword (Postgres full-text) + vector
// (pgvector cosine similarity), merged with Reciprocal Rank Fusion.
// ---------------------------------------------------------------------------
 
const AI_URL = process.env.AI_SERVICE_URL ?? "http://host.docker.internal:8000";

const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

/** Ask the Python AI service to embed texts (bge-small, 384 dimensions). */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const r = await fetch(`${AI_URL}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": process.env.AI_SERVICE_TOKEN ?? "",
    },
    body: JSON.stringify({ texts }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`embed failed: ${r.status}`);
  const data = (await r.json()) as { vectors: number[][] };
  return data.vectors;
}
 
type Row = { id: string; title: string; body: string; category: string | null };
type VectorRow = Row & { distance: number };

const MAX_DISTANCE = Number(process.env.KB_MAX_DISTANCE ?? 0.40);
const MARGIN = Number(process.env.KB_MARGIN ?? 0.10);

async function vectorSearch(query: string, limit = 5): Promise<VectorRow[]> {
  const [qv] = await embedTexts([QUERY_PREFIX + query.slice(0, 1000)]);
  if (!qv) return [];

  const distance = cosineDistance(kbArticlesTable.embedding, qv);
  const rows = (
    await db
      .select({
        id: kbArticlesTable.id,
        title: kbArticlesTable.title,
        body: kbArticlesTable.body,
        category: kbArticlesTable.category,
        distance,
      })
      .from(kbArticlesTable)
      .where(and(eq(kbArticlesTable.isPublished, true), isNotNull(kbArticlesTable.embedding)))
      .orderBy(distance)
      .limit(limit)
  ).map((r) => ({ ...r, distance: Number(r.distance) }));

  logger.debug({ distances: rows.map((r) => [r.title, +r.distance.toFixed(3)]) }, "vector distances");

  if (rows.length === 0) return [];
  const best = rows[0].distance;
  return rows.filter((r) => r.distance <= MAX_DISTANCE && r.distance <= best + MARGIN);
}
/** Embed every article that has no vector yet. Call once after adding the column, and after editing articles. */
export async function backfillArticleEmbeddings(onlyMissing = true): Promise<number> {
  const articles = await db
    .select({ id: kbArticlesTable.id, title: kbArticlesTable.title, body: kbArticlesTable.body })
    .from(kbArticlesTable)
    .where(onlyMissing ? isNull(kbArticlesTable.embedding) : undefined);
  if (articles.length === 0) return 0;
  const vectors = await embedTexts(articles.map((a) => `${a.title}\n${a.body}`));
  for (const [i, a] of articles.entries()) {
    await db.update(kbArticlesTable).set({ embedding: vectors[i] }).where(eq(kbArticlesTable.id, a.id));
  }
  return articles.length;
}
 
const STOPWORDS = new Set([
  "the", "and", "with", "this", "that", "have", "from", "please", "cannot", "cant", "dont",
  "not", "working", "issue", "help", "need", "when", "after", "been", "just", "also",
]);
 
function toOrQuery(text: string): string {
  const words = [...new Set(text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])]
    .filter((w) => !STOPWORDS.has(w))
    .slice(0, 30);
  return words.join(" | ");
}
 
async function keywordSearch(title: string, description: string, limit = 5): Promise<Row[]> {
  const orQuery = toOrQuery(`${title} ${description}`);
  if (!orQuery) return [];
  const tsv = sql`to_tsvector('english', coalesce(${kbArticlesTable.title}, '') || ' ' || coalesce(${kbArticlesTable.body}, ''))`;
  const tsq = sql`to_tsquery('english', ${orQuery})`;
  return db
    .select({
      id: kbArticlesTable.id,
      title: kbArticlesTable.title,
      body: kbArticlesTable.body,
      category: kbArticlesTable.category,
    })
    .from(kbArticlesTable)
    .where(and(eq(kbArticlesTable.isPublished, true), sql`${tsv} @@ ${tsq}`))
    .orderBy(desc(sql`ts_rank(${tsv}, ${tsq})`))
    .limit(limit);
}
 
 
/** Reciprocal Rank Fusion: merge several ranked lists into one. */
function rrf(lists: Row[][], limit: number, k = 60): Row[] {
  const score = new Map<string, number>();
  const rows = new Map<string, Row>();
  for (const list of lists) {
    list.forEach((row, i) => {
      rows.set(row.id, row);
      score.set(row.id, (score.get(row.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => rows.get(id)!);
}
 
async function findRelevantArticles(title: string, description: string, limit = 3): Promise<Row[]> {
  const [kw, vec] = await Promise.all([
    keywordSearch(title, description, 5).catch((e) => {
      console.warn("Keyword search failed:", e?.cause?.message ?? e?.message);
      return [] as Row[];
    }),
    vectorSearch(`${title}. ${description}`, 5).catch((e) => {
      console.warn("Vector search failed:", e?.cause?.message ?? e?.message);
      return [] as Row[];
    }),
  ]);
  console.log(
    "retrieval | keyword:", kw.map((r) => r.title),
    "| vector:", vec.map((r) => r.title),
  );
  return rrf([kw, vec], limit);
}
 
router.get("/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
 
  const user = req.authUser!;
  const tickets = await getVisibleTickets(user, parsed.data);
  const [userMap, commentCounts] = await Promise.all([
    getTicketUsers(tickets),
    getCommentCounts(tickets.map((ticket) => ticket.id), user.role !== "requester"),
  ]);
  const response = tickets.flatMap((ticket) => {
    const requester = userMap.get(ticket.requesterId);
    if (!requester) return [];
    const assignedAgent = ticket.assignedAgentId ? userMap.get(ticket.assignedAgentId) ?? null : null;
    return [makeTicketResponse(ticket, requester, assignedAgent, commentCounts.get(ticket.id) ?? 0)];
  });
 
  res.json(ListTicketsResponse.parse(await Promise.all(response)));
});
 
router.post("/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
 
  const user = req.authUser!;
  if (
    parsed.data.title.trim().length < 5 ||
    parsed.data.description.trim().length < 10 ||
    parsed.data.category.trim().length < 2
  ) {
    res.status(400).json({ error: "Title, description, and category must contain meaningful text." });
    return;
  }
  const priority = parsed.data.priority ?? "P3";
  const responseHours = await getSlaHours(priority);
  const now = new Date();
  const slaDeadline = createSlaDeadline(now, responseHours);
  const ticket = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(ticketsTable)
      .values({
        title: parsed.data.title.trim(),
        description: parsed.data.description.trim(),
        category: parsed.data.category.trim(),
        priority,
        status: "new",
        requesterId: user.id,
        slaDeadline,
      })
      .returning();
 
    if (created) {
      await tx.insert(auditLogsTable).values({
        actorId: user.id,
        ticketId: created.id,
        action: "ticket.created",
        details: { priority, category: created.category },
      });
    }
    return created;
  });
 
  if (!ticket) {
    res.status(500).json({ error: "Ticket could not be created." });
    return;
  }
    void runAiAnalysis(ticket).catch((err) => console.warn("AI analysis failed:", err));

  emitAutomationEvent("ticket-created", `ticket-created:${ticket.id}`, {
    ticketId: ticket.id,
    title: ticket.title,
    priority: ticket.priority,
    category: ticket.category,
    requesterEmail: user.email,
  });
  if (ticket.priority === "P1") {
    emitAutomationEvent("ticket-p1", `ticket-p1:${ticket.id}`, {
      ticketId: ticket.id,
      title: ticket.title,
    });
  }
 
  const result = await makeTicketResponse(ticket, user, null, 0);
  res.status(201).json(CreateTicketResponse.parse(result));
});
 
router.get("/tickets/:ticketId", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetTicketParams.safeParse(req.params);
  const ticketId = getParamId(req.params.ticketId);
  if (!parsed.success || !ticketId) {
    res.status(400).json({ error: "A valid ticket ID is required." });
    return;
  }
 
  const ticket = await getReadableTicket(ticketId, req.authUser!);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  const response = await getTicketDetailResponse(ticket, req.authUser!);
  if (!response) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  res.json(response);
});
 
async function runAiAnalysis(ticket: Ticket): Promise<void> {
  const controller = new AbortController();
  // Retrieval now includes an embedding call, so allow a bit more time than before.
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    // A retrieval failure should not stop the analysis, so fall back to no articles.
    const articles = await findRelevantArticles(ticket.title, ticket.description).catch((err) => {
      console.warn("Article lookup failed, continuing without articles:", err?.cause?.message ?? err?.message);
      return [] as Row[];
    });
 
    const aiResponse = await fetch(`${AI_URL}/analyze-ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": process.env.AI_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({
        title: ticket.title,
        description: ticket.description,
        articles: articles.map((a) => ({
          id: a.id,
          title: a.title,
          excerpt: a.body.slice(0, 1800),
        })),
        candidate_tickets: [],
      }),
      signal: controller.signal,
    });
 
    if (!aiResponse.ok) {
      console.warn("AI Service returned an error:", aiResponse.status, await aiResponse.text());
      return;
    }
 
    const aiData: any = await aiResponse.json();
    const validPriorities = ["P1", "P2", "P3", "P4"];
 
    await db.insert(ticketAiAnalysisTable).values({
      ticketId: ticket.id,
      category: aiData.category ?? "",
      priority: validPriorities.includes(aiData.priority) ? aiData.priority : ticket.priority,
      urgency: aiData.urgency ?? "",
      summary: aiData.summary ?? "",
      suggestedTeam: aiData.suggested_team ?? "",
      suggestedArticleIds: aiData.suggested_article_ids ?? [],
      duplicateTicketIds: aiData.duplicate_ticket_ids ?? [],
      suggestedReply: aiData.suggested_reply ?? "",
      provider: aiData.provider ?? "",
      model: aiData.model ?? "",
    });
    console.log("AI analysis saved for ticket", ticket.id, "| articles sent:", articles.length);
  } finally {
    clearTimeout(timeoutId);
  }
}
 
router.post("/tickets/:ticketId/comments", requireAuth, async (req, res): Promise<void> => {
  const params = CreateTicketCommentParams.safeParse(req.params);
  const body = CreateTicketCommentBody.safeParse(req.body);
  const ticketId = getParamId(req.params.ticketId);
  if (!params.success || !ticketId || !body.success) {
    res.status(400).json({ error: "A valid ticket ID and comment are required." });
    return;
  }
 
  const user = req.authUser!;
  const ticket = await getReadableTicket(ticketId, user);
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found." });
    return;
  }
  if (ticket.status === "closed") {
    res.status(409).json({ error: "Closed tickets cannot receive new comments." });
    return;
  }
  if (body.data.isInternal && user.role === "requester") {
    res.status(403).json({ error: "Only support staff can add internal notes." });
    return;
  }
  if (!body.data.body.trim()) {
    res.status(400).json({ error: "Comment cannot be empty." });
    return;
  }
 
  const [comment] = await db
    .insert(ticketCommentsTable)
    .values({
      ticketId,
      authorId: user.id,
      body: body.data.body.trim(),
      isInternal: body.data.isInternal ?? false,
    })
    .returning();
  if (!comment) {
    res.status(500).json({ error: "Comment could not be saved." });
    return;
  }
  await db
    .update(ticketsTable)
    .set({ updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId));
  await db.insert(auditLogsTable).values({
    actorId: user.id,
    ticketId,
    action: comment.isInternal ? "ticket.note_added" : "ticket.comment_added",
    details: {},
  });
 
  res.status(201).json(CreateTicketCommentResponse.parse({
    id: comment.id,
    ticketId: comment.ticketId,
    author: toPublicUser(user),
    body: comment.body,
    isInternal: comment.isInternal,
    createdAt: comment.createdAt.toISOString(),
  }));
});
 
router.patch("/tickets/:ticketId/status", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateTicketStatusParams.safeParse(req.params);
  const body = UpdateTicketStatusBody.safeParse(req.body);
  const ticketId = getParamId(req.params.ticketId);
  if (!params.success || !ticketId || !body.success) {
    res.status(400).json({ error: "A valid ticket ID and status are required." });
    return;
  }
 
  const user = req.authUser!;
  const result = await db.transaction(async (tx) => {
    const [ticket] = await tx
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, ticketId))
      .for("update");
    if (!ticket) return { error: "not_found" as const };
    if (user.role === "requester" && ticket.requesterId !== user.id) return { error: "not_found" as const };
    if (user.role === "agent" && ticket.assignedAgentId !== null && ticket.assignedAgentId !== user.id) {
      return { error: "not_found" as const };
    }
 
    const nextStatus = body.data.status;
    if (nextStatus === "assigned" && !ticket.assignedAgentId) {
      return { error: "assign_first" as const };
    }
    if (!canTransitionTicket({
      role: user.role,
      userId: user.id,
      requesterId: ticket.requesterId,
      assignedAgentId: ticket.assignedAgentId,
      currentStatus: ticket.status,
      nextStatus,
    })) {
      return { error: user.role === "requester" ? "forbidden" as const : "invalid_transition" as const };
    }
    const resolvedAt = nextStatus === "resolved"
      ? new Date()
      : nextStatus === "closed"
        ? ticket.resolvedAt
        : null;
    const [updated] = await tx
      .update(ticketsTable)
      .set({ status: nextStatus, resolvedAt, updatedAt: new Date() })
      .where(eq(ticketsTable.id, ticketId))
      .returning();
    await tx.insert(auditLogsTable).values({
      actorId: user.id,
      ticketId,
      action: "ticket.status_changed",
      details: { from: ticket.status, to: nextStatus },
    });
    return { ticket: updated };
  });
 
  if ("error" in result && result.error) {
    const error = result.error;
    const status = error === "not_found" ? 404 : error === "forbidden" ? 403 : 409;
    const messages = {
      not_found: "Ticket not found.",
      forbidden: "You can only close your own resolved tickets.",
      invalid_transition: "That status change is not allowed.",
      assign_first: "Assign the ticket before marking it assigned.",
    };
    res.status(status).json({ error: messages[error] });
    return;
  }
  if (!result.ticket) {
    res.status(500).json({ error: "Ticket could not be updated." });
    return;
  }
  const userMap = await getTicketUsers([result.ticket]);
  const requester = userMap.get(result.ticket.requesterId);
  if (!requester) {
    res.status(500).json({ error: "Ticket requester could not be loaded." });
    return;
  }
  const [comments] = await db
    .select({ total: count() })
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.ticketId, ticketId));
  const response = await makeTicketResponse(
    result.ticket,
    requester,
    result.ticket.assignedAgentId ? userMap.get(result.ticket.assignedAgentId) ?? null : null,
    Number(comments?.total ?? 0),
  );
    if (body.data.status === "resolved") {
    emitAutomationEvent("ticket-resolved", `ticket-resolved:${result.ticket.id}`, {
      ticketId: result.ticket.id,
      title: result.ticket.title,
      requesterEmail: requester.email,
    });
  }
  res.json(UpdateTicketStatusResponse.parse(response));
});
 
router.patch(
  "/tickets/:ticketId/assignment",
  requireAuth,
  requireRoles("agent", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateTicketAssignmentParams.safeParse(req.params);
    const body = UpdateTicketAssignmentBody.safeParse(req.body);
    const ticketId = getParamId(req.params.ticketId);
    if (!params.success || !ticketId || !body.success) {
      res.status(400).json({ error: "A valid ticket ID and agent ID are required." });
      return;
    }
    const user = req.authUser!;
    const agentId = body.data.agentId;
    if (agentId !== null && !uuidPattern.test(agentId)) {
      res.status(400).json({ error: "Choose a valid agent account." });
      return;
    }
 
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(ticketsTable)
        .where(eq(ticketsTable.id, ticketId))
        .for("update");
      if (!ticket) return { error: "not_found" as const };
 
      if (!canChangeAssignment({
        role: user.role,
        userId: user.id,
        currentAgentId: ticket.assignedAgentId,
        nextAgentId: agentId,
      })) {
        // A ticket owned by another agent is invisible to this agent, so treat it as missing.
        const ownedByOther = user.role === "agent"
          && ticket.assignedAgentId !== null
          && ticket.assignedAgentId !== user.id;
        return { error: ownedByOther ? "not_found" as const : "forbidden" as const };
      }
 
      if (agentId) {
        const [agent] = await tx.select().from(usersTable).where(eq(usersTable.id, agentId));
        if (!agent || !agent.isActive || (agent.role !== "agent" && agent.role !== "admin")) {
          return { error: "invalid_agent" as const };
        }
      }
 
      if (ticket.assignedAgentId !== agentId) {
        await tx
          .update(ticketAssignmentsTable)
          .set({ unassignedAt: new Date() })
          .where(and(eq(ticketAssignmentsTable.ticketId, ticketId), isNull(ticketAssignmentsTable.unassignedAt)));
        if (agentId) {
          await tx.insert(ticketAssignmentsTable).values({
            ticketId,
            agentId,
            assignedById: user.id,
          });
        }
      }
 
      const nextStatus = statusAfterAssignment(ticket.status, Boolean(agentId));
      const [updated] = await tx
        .update(ticketsTable)
        .set({ assignedAgentId: agentId, status: nextStatus, updatedAt: new Date() })
        .where(eq(ticketsTable.id, ticketId))
        .returning();
      await tx.insert(auditLogsTable).values({
        actorId: user.id,
        ticketId,
        action: "ticket.assignment_changed",
        details: { from: ticket.assignedAgentId, to: agentId },
      });
      return { ticket: updated };
    });
 
    if ("error" in result) {
      if (result.error === "forbidden") {
        res.status(403).json({ error: "Agents can only assign tickets to themselves." });
        return;
      }
      res.status(result.error === "not_found" ? 404 : 400).json({
        error: result.error === "not_found" ? "Ticket not found." : "Choose an active agent account.",
      });
      return;
    }
    if (!result.ticket) {
      res.status(500).json({ error: "Ticket could not be assigned." });
      return;
    }
    const userMap = await getTicketUsers([result.ticket]);
    const requester = userMap.get(result.ticket.requesterId);
    if (!requester) {
      res.status(500).json({ error: "Ticket requester could not be loaded." });
      return;
    }
    const [comments] = await db
      .select({ total: count() })
      .from(ticketCommentsTable)
      .where(eq(ticketCommentsTable.ticketId, ticketId));
    const response = await makeTicketResponse(
      result.ticket,
      requester,
      result.ticket.assignedAgentId ? userMap.get(result.ticket.assignedAgentId) ?? null : null,
      Number(comments?.total ?? 0),
    );
    res.json(UpdateTicketAssignmentResponse.parse(response));
  },
);
 
router.patch(
  "/tickets/:ticketId/priority",
  requireAuth,
  requireRoles("agent", "admin"),
  async (req, res): Promise<void> => {
    const params = UpdateTicketPriorityParams.safeParse(req.params);
    const body = UpdateTicketPriorityBody.safeParse(req.body);
    const ticketId = getParamId(req.params.ticketId);
    if (!params.success || !ticketId || !body.success) {
      res.status(400).json({ error: "A valid ticket ID and priority are required." });
      return;
    }
    const user = req.authUser!;
    const responseHours = await getSlaHours(body.data.priority);
    const result = await db.transaction(async (tx) => {
      const [ticket] = await tx
        .select()
        .from(ticketsTable)
        .where(eq(ticketsTable.id, ticketId))
        .for("update");
      if (!ticket) return { error: "not_found" as const };
      if (user.role === "agent" && ticket.assignedAgentId !== null && ticket.assignedAgentId !== user.id) {
        return { error: "not_found" as const };
      }
      const [updated] = await tx
        .update(ticketsTable)
        .set({
          priority: body.data.priority,
          slaDeadline: new Date(ticket.createdAt.getTime() + responseHours * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(ticketsTable.id, ticketId))
        .returning();
      await tx.insert(auditLogsTable).values({
        actorId: user.id,
        ticketId,
        action: "ticket.priority_changed",
        details: { from: ticket.priority, to: body.data.priority },
      });
        return { ticket: updated, previousPriority: ticket.priority };
    });
    if ("error" in result) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }
    if (!result.ticket) {
      res.status(500).json({ error: "Ticket could not be updated." });
      return;
    }
    const userMap = await getTicketUsers([result.ticket]);
    const requester = userMap.get(result.ticket.requesterId);
    if (!requester) {
      res.status(500).json({ error: "Ticket requester could not be loaded." });
      return;
    }
    const [comments] = await db
      .select({ total: count() })
      .from(ticketCommentsTable)
      .where(eq(ticketCommentsTable.ticketId, ticketId));
    const response = await makeTicketResponse(
      result.ticket,
      requester,
      result.ticket.assignedAgentId ? userMap.get(result.ticket.assignedAgentId) ?? null : null,
      Number(comments?.total ?? 0),
    );
        if (result.ticket.priority === "P1" && result.previousPriority !== "P1") {
      emitAutomationEvent("ticket-p1", `ticket-p1:${result.ticket.id}`, {
        ticketId: result.ticket.id,
        title: result.ticket.title,
      });
    }
    res.json(UpdateTicketPriorityResponse.parse(response));
  },
);
 
export default router;
 
