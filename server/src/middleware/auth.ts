import type { NextFunction, Request, Response } from "express";
import { UserStatus } from "@prisma/client";
import {
  AUTH_COOKIE,
  verifyAuthToken,
  type AuthToken,
} from "../lib/auth";
import { isDatabaseConnectionError } from "../lib/database";
import { prisma } from "../lib/prisma";

declare global {
  namespace Express {
    interface Request {
      user?: AuthToken;
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    next();
    return;
  }
  try {
    req.user = verifyAuthToken(token);
  } catch {
    req.user = undefined;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    const account = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, name: true, role: true, status: true },
    });
    if (!account || account.status === UserStatus.DISABLED) {
      res.status(403).json({ error: "This account has been disabled. Contact an administrator." });
      return;
    }
    req.user = {
      userId: payload.userId,
      email: account.email,
      name: account.name,
      role: account.role,
    };
    next();
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      next(error);
      return;
    }
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, (error?: unknown) => {
    if (error) {
      next(error);
      return;
    }
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  });
}
