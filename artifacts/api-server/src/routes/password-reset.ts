import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { hash } from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  ForgotPasswordBody,
  ForgotPasswordResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
} from "@workspace/api-zod";
import { db, passwordResetTokensTable, usersTable } from "@workspace/db";
import { allowedOrigins } from "../middlewares/csrf";
import { sendMail } from "../lib/mail";

const router: IRouter = Router();

const TOKEN_TTL_MS = 60 * 60 * 1000;
const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function appUrl(): string {
  const configured = process.env.APP_URL?.trim() || [...allowedOrigins][0] || "http://localhost:8080";
  return configured.replace(/\/+$/, "");
}

router.post("/auth/forgot-password", resetLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (user && user.isActive) {
    const token = randomBytes(32).toString("base64url");
    await db.transaction(async (tx) => {
      await tx.delete(passwordResetTokensTable).where(eq(passwordResetTokensTable.userId, user.id));
      await tx.insert(passwordResetTokensTable).values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      });
    });

    const link = `${appUrl()}/reset-password?token=${token}`;
    // Not awaited, so the response time does not reveal whether the account exists.
    void sendMail({
      to: user.email,
      subject: "Reset your HelpDeskAI password",
      text:
        `Hi ${user.fullName},\n\n` +
        `Use this link to choose a new password. It works once and expires in 1 hour:\n\n${link}\n\n` +
        `If you did not ask for this, you can ignore this email.`,
    }).catch((err) => req.log.error({ err }, "Could not send password reset email"));
  }

  res.json(ForgotPasswordResponse.parse({ message: GENERIC_MESSAGE }));
});

router.post("/auth/reset-password", resetLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const tokenHash = hashToken(parsed.data.token);

  const changed = await db.transaction(async (tx) => {
    // The conditional update is what makes a token single-use, even under concurrent requests.
    const [spent] = await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokensTable.userId });
    if (!spent) return false;

    const [updated] = await tx
      .update(usersTable)
      .set({ passwordHash })
      .where(and(eq(usersTable.id, spent.userId), eq(usersTable.isActive, true)))
      .returning({ id: usersTable.id });
    return Boolean(updated);
  });

  if (!changed) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }
  res.json(ResetPasswordResponse.parse({ message: "Your password has been changed. You can sign in now." }));
});

export default router;