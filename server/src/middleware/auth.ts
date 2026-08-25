import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, verifyAdminToken, type AdminToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      admin?: AdminToken;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
