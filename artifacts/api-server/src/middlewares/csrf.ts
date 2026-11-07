import type { NextFunction, Request, Response } from "express";

export const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

/** Rejects unsafe requests whose Origin header is not on the allow-list. */
export function originCheck(req: Request, res: Response, next: NextFunction): void {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }
  const origin = req.get("origin");
  if (origin === undefined || allowedOrigins.has(origin)) {
    next();
    return;
  }
  res.status(403).json({ error: "Request origin is not allowed." });
}