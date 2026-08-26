import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const DATABASE_UNAVAILABLE_MESSAGE =
  "Can't reach the database right now. Check that MySQL is running and try again.";

const PRISMA_CONNECTION_CODES = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1009",
  "P1010",
  "P1011",
  "P1017",
  "P2024",
]);

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNRESET",
  "EPIPE",
  "EHOSTUNREACH",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_CON_COUNT_ERROR",
]);

function readCode(error: object): string {
  const record = error as { code?: unknown; errorCode?: unknown };
  if (typeof record.errorCode === "string" && record.errorCode) return record.errorCode;
  if (typeof record.code === "string" && record.code) return record.code;
  if (typeof record.code === "number") return String(record.code);
  return "";
}

function looksLikeConnectionMessage(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("can't reach database")
    || text.includes("cannot reach database")
    || text.includes("server has closed the connection")
    || text.includes("connection refused")
    || text.includes("connect econnrefused")
    || text.includes("connection timed out")
    || text.includes("timed out fetching a new connection")
    || text.includes("database server")
    || text.includes("unknown database")
    || text.includes("access denied for user")
  );
}

export function isDatabaseConnectionError(error: unknown, depth = 0): boolean {
  if (!error || depth > 4) return false;
  if (typeof error !== "object") return false;

  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && PRISMA_CONNECTION_CODES.has(error.code)) {
    return true;
  }

  const code = readCode(error);
  if (PRISMA_CONNECTION_CODES.has(code) || NETWORK_CODES.has(code)) return true;

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  if (message && looksLikeConnectionMessage(message)) return true;

  if ("cause" in error) return isDatabaseConnectionError(error.cause, depth + 1);
  return false;
}

export async function checkDatabase(timeoutMs = 2000): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database health check timed out")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}
