import type { NextFunction, Request, Response } from "express";
import { isDatabaseConnectionError } from "../lib/database";
import { prisma } from "../lib/prisma";
import { requestIp } from "../lib/logging";

const SKIP = new Set(["/api/health", "/api/admin/traffic", "/api/admin/logs", "/api/admin/overview"]);

export function trafficLogger(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api") || SKIP.has(req.path)) {
    next();
    return;
  }

  const started = Date.now();
  res.on("finish", () => {
    void prisma.trafficEvent
      .create({
        data: {
          method: req.method.slice(0, 10),
          path: req.originalUrl.slice(0, 255),
          status: res.statusCode,
          durationMs: Date.now() - started,
          ip: requestIp(req),
          userId: req.user?.userId,
        },
      })
      .catch((error) => {
        if (isDatabaseConnectionError(error)) {
          console.error("Database unavailable; skipped traffic log");
          return;
        }
        console.error("Failed to record traffic", error);
      });
  });
  next();
}
