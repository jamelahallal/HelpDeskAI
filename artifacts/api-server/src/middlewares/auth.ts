import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
}

const sessionKey = new TextEncoder().encode(sessionSecret);

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // Secure cookies are only sent over HTTPS. Defaults to on in production;
    // set COOKIE_SECURE=false to run the production build over plain HTTP locally.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export async function issueSessionToken(userId: string): Promise<string> {
  const { SignJWT } = await import("jose");
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(sessionKey);
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  return (async () => {
    const token = req.cookies?.helpdesk_session;
    if (typeof token !== "string" || !token) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    let subject: string | undefined;
    try {
      const { payload } = await jwtVerify(token, sessionKey, {
        algorithms: ["HS256"],
      });
      subject = payload.sub;
    } catch {
      res.clearCookie("helpdesk_session", sessionCookieOptions());
      res.status(401).json({ error: "Your session is invalid or expired." });
      return;
    }

    if (!subject) {
      res.status(401).json({ error: "Your session is invalid or expired." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, subject));
    if (!user || !user.isActive) {
      res.clearCookie("helpdesk_session", sessionCookieOptions());
      res.status(401).json({ error: "This account is unavailable." });
      return;
    }

    req.authUser = user;
    next();
  })().catch(next);
}

export function requireRoles(...roles: User["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "You do not have permission to do that." });
      return;
    }
    next();
  };
}
