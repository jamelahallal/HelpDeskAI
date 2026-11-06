import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import rateLimit from "express-rate-limit";
import {
  GetCurrentUserResponse,
  LoginUserBody,
  LoginUserResponse,
  LogoutUserResponse,
  RegisterUserBody,
  RegisterUserResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { issueSessionToken, requireAuth, sessionCookieOptions } from "../middlewares/auth";

const router: IRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

function toPublicUser(user: typeof usersTable.$inferSelect) {
  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    initials,
  };
}

router.post("/auth/register", authLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await hash(parsed.data.password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({
      fullName: parsed.data.fullName.trim(),
      email,
      passwordHash,
      role: "requester",
    })
    .onConflictDoNothing({ target: usersTable.email })
    .returning();

  if (!user) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const token = await issueSessionToken(user.id);
  res.cookie("helpdesk_session", token, sessionCookieOptions());
  res.status(201).json(RegisterUserResponse.parse({ user: toPublicUser(user) }));
});

router.post("/auth/login", authLimiter, async (req, res): Promise<void> => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const validPassword = user ? await compare(parsed.data.password, user.passwordHash) : false;

  if (!user || !user.isActive || !validPassword) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  const token = await issueSessionToken(user.id);
  res.cookie("helpdesk_session", token, sessionCookieOptions());
  res.json(LoginUserResponse.parse({ user: toPublicUser(user) }));
});

router.post("/auth/logout", (req, res): void => {
  res.clearCookie("helpdesk_session", sessionCookieOptions());
  res.json(LogoutUserResponse.parse({ message: "Signed out." }));
});

router.get("/auth/me", requireAuth, (req, res): void => {
  if (!req.authUser) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  res.json(GetCurrentUserResponse.parse(toPublicUser(req.authUser)));
});

export default router;
