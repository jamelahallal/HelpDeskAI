import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requireAutomationKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.AUTOMATION_API_KEY ?? "";
  const given = req.header("x-automation-key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}