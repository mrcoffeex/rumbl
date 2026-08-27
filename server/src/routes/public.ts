import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { Prisma, SessionStatus } from "@prisma/client";
import { z } from "zod";
import { invalidateSessionCaches, readCache, sessionCacheKeys } from "../lib/cache";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { calculateCapacity } from "../lib/grouping";
import { HttpError } from "../middleware/errors";

export const publicRouter = Router();

const DEVICE_COOKIE = "rumbl_device";
const deviceId = z.string().uuid();
const PUBLIC_SESSION_TTL_MS = 1_500;
const PUBLIC_RESULTS_OPEN_TTL_MS = 1_500;
const PUBLIC_RESULTS_GROUPED_TTL_MS = 5_000;

publicRouter.use((req, res, next) => {
  let id = req.cookies[DEVICE_COOKIE];
  if (!deviceId.safeParse(id).success) {
    id = randomUUID();
    res.cookie(DEVICE_COOKIE, id, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: "/api/public",
    });
  }
  req.cookies[DEVICE_COOKIE] = id;
  next();
});

const enrollLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  keyGenerator: (req) => String(req.cookies[DEVICE_COOKIE]),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Please wait one minute before registering another student" },
});

const tokenParam = z.string().min(16).max(64);

type PublicSessionPayload = {
  id: number;
  title: string;
  status: SessionStatus;
  expectedStudentCount: number | null;
  registeredCount: number;
  roles: Array<{
    id: number;
    name: string;
    slotsPerGroup: number;
    capacity: number | null;
    registeredCount: number;
  }>;
};

type PublicResultsPayload = {
  session: { id: number; title: string; status: SessionStatus };
  groups: unknown[];
};

async function loadPublicSession(token: string): Promise<PublicSessionPayload> {
  const session = await prisma.session.findUnique({
    where: { publicToken: token },
    include: {
      roles: {
        orderBy: { position: "asc" },
        include: { _count: { select: { students: true } } },
      },
      _count: { select: { students: true } },
    },
  });
  if (!session) throw new HttpError(404, "Session not found");

  const capacity = calculateCapacity(session.expectedStudentCount, session.roles);
  return {
    id: session.id,
    title: session.title,
    status: session.status,
    expectedStudentCount: session.expectedStudentCount,
    registeredCount: session._count.students,
    roles: session.roles.map((role) => ({
      id: role.id,
      name: role.name,
      slotsPerGroup: role.slotsPerGroup,
      capacity: capacity.roles.find((item) => item.id === role.id)!.capacity,
      registeredCount: role._count.students,
    })),
  };
}

async function loadPublicResults(token: string): Promise<PublicResultsPayload> {
  const session = await prisma.session.findUnique({
    where: { publicToken: token },
    select: { id: true, title: true, status: true },
  });
  if (!session) throw new HttpError(404, "Session not found");

  const groups =
    session.status === SessionStatus.GROUPED
      ? await prisma.generatedGroup.findMany({
          where: { sessionId: session.id },
          orderBy: { position: "asc" },
          select: {
            id: true,
            name: true,
            position: true,
            members: {
              orderBy: { id: "asc" },
              select: {
                student: { select: { id: true, name: true } },
                role: { select: { id: true, name: true } },
              },
            },
          },
        })
      : [];

  return {
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
    },
    groups,
  };
}

publicRouter.get("/sessions/:token", async (req, res) => {
  const token = tokenParam.parse(req.params.token);
  const cacheKey = sessionCacheKeys(0, token).publicSession!;
  const session = await readCache.getOrSet(cacheKey, () => loadPublicSession(token), PUBLIC_SESSION_TTL_MS);
  // Join pages poll every 2s; short private cache cuts duplicate round-trips.
  res.setHeader("Cache-Control", "private, max-age=1");
  res.json({ session });
});

publicRouter.post("/sessions/:token/enroll", enrollLimiter, async (req, res) => {
  const token = tokenParam.parse(req.params.token);
  const input = z
    .object({
      name: z.string().trim().min(1).max(150),
      roleId: z.number().int().positive(),
    })
    .parse(req.body);

  const student = await withSerializableRetry(async () =>
    prisma.$transaction(
      async (tx) => {
        const session = await tx.session.findUnique({
          where: { publicToken: token },
          include: { roles: { orderBy: { position: "asc" } } },
        });
        if (!session) throw new HttpError(404, "Session not found");
        if (session.status !== SessionStatus.OPEN) {
          throw new HttpError(409, "This session is not accepting registrations");
        }

        const role = session.roles.find((item) => item.id === input.roleId);
        if (!role) throw new HttpError(400, "Role does not belong to this session");

        const duplicate = await tx.student.findFirst({
          where: { sessionId: session.id, name: input.name },
          select: { id: true },
        });
        if (duplicate) throw new HttpError(409, "That name is already registered");

        if (session.expectedStudentCount != null) {
          const totalRegistered = await tx.student.count({ where: { sessionId: session.id } });
          if (totalRegistered >= session.expectedStudentCount) {
            throw new HttpError(409, "This session is full");
          }

          const capacity = calculateCapacity(
            session.expectedStudentCount,
            session.roles,
          ).roles.find((item) => item.id === role.id)!.capacity;
          const registered = await tx.student.count({
            where: { sessionId: session.id, roleId: role.id },
          });
          if (capacity != null && registered >= capacity) {
            throw new HttpError(409, "That role is full");
          }
        }

        return tx.student.create({
          data: { sessionId: session.id, roleId: role.id, name: input.name },
          include: { role: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );

  invalidateSessionCaches(student.sessionId, token);
  res.status(201).json({ student });
});

publicRouter.get("/sessions/:token/results", async (req, res) => {
  const token = tokenParam.parse(req.params.token);
  const cacheKey = sessionCacheKeys(0, token).publicResults!;
  let payload = readCache.get<PublicResultsPayload>(cacheKey);
  if (!payload) {
    payload = await loadPublicResults(token);
    // Grouped results only change on reshuffle (invalidated there).
    const ttl =
      payload.session.status === SessionStatus.GROUPED
        ? PUBLIC_RESULTS_GROUPED_TTL_MS
        : PUBLIC_RESULTS_OPEN_TTL_MS;
    readCache.set(cacheKey, payload, ttl);
  }

  res.setHeader(
    "Cache-Control",
    payload.session.status === SessionStatus.GROUPED
      ? "private, max-age=5"
      : "private, max-age=1",
  );
  res.json(payload);
});

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error("Transaction retry exhausted");
}
