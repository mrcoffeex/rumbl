import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseConnectionError } from "../lib/database";
import { writeLog } from "../lib/logging";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (res.headersSent) return;

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Invalid request", details: error.issues });
    return;
  }
  if (isDatabaseConnectionError(error)) {
    console.error("Database unavailable", error);
    res.setHeader("Retry-After", "5");
    res.status(503).json({ error: DATABASE_UNAVAILABLE_MESSAGE });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({ error: "A record with that value already exists" });
    return;
  }

  console.error(error);
  void writeLog({
    level: "error",
    category: "system",
    message: error instanceof Error ? error.message.slice(0, 500) : "Internal server error",
  });
  res.status(500).json({ error: "Internal server error" });
}
