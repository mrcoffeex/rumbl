import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type LogInput = {
  level?: "info" | "warn" | "error";
  category: string;
  message: string;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
  userId?: number | null;
};

export async function writeLog(input: LogInput) {
  try {
    await prisma.systemLog.create({
      data: {
        level: input.level ?? "info",
        category: input.category,
        message: input.message.slice(0, 500),
        meta: input.meta,
        ip: input.ip ?? undefined,
        userId: input.userId ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write system log", error);
  }
}

export function requestIp(req: { ip?: string; headers: { [key: string]: unknown } }) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.ip;
}
