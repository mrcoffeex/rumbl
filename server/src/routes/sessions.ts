import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SessionStatus } from "@prisma/client";
import { z } from "zod";
import { invalidateSessionCaches, readCache, sessionCacheKeys } from "../lib/cache";
import { prisma } from "../lib/prisma";
import { calculateCapacity, generateGroups } from "../lib/grouping";
import { requestIp, writeLog } from "../lib/logging";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/errors";
import type { AuthToken } from "../lib/auth";

export const sessionRouter = Router();
sessionRouter.use(requireAuth);

const roleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slotsPerGroup: z.number().int().min(1).max(100),
});

const sessionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    expectedStudentCount: z.number().int().min(1).max(100_000).nullable(),
    roles: z.array(roleSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const names = value.roles.map((role) => role.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      context.addIssue({ code: "custom", message: "Role names must be unique", path: ["roles"] });
    }
    const groupSize = value.roles.reduce((sum, role) => sum + role.slotsPerGroup, 0);
    if (value.expectedStudentCount != null && value.expectedStudentCount < groupSize) {
      context.addIssue({
        code: "custom",
        message: "Participant limit must accommodate at least one complete group",
        path: ["expectedStudentCount"],
      });
    }
  });

function canView(user: AuthToken, ownerId: number) {
  return user.role === "ADMIN" || ownerId === user.userId;
}

function canManage(user: AuthToken, ownerId: number) {
  return ownerId === user.userId;
}

async function requireVisibleSession(id: number, user: AuthToken) {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || !canView(user, session.ownerId)) {
    throw new HttpError(404, "Session not found");
  }
  return session;
}

async function requireManagedSession(id: number, user: AuthToken) {
  const session = await requireVisibleSession(id, user);
  if (!canManage(user, session.ownerId)) {
    throw new HttpError(403, "You can only manage your own groups");
  }
  return session;
}

function sessionPayload<T extends {
  expectedStudentCount: number | null;
  roles: Array<{ id: number; name: string; slotsPerGroup: number }>;
}>(session: T) {
  return {
    ...session,
    capacity: calculateCapacity(session.expectedStudentCount, session.roles),
  };
}

sessionRouter.get("/", async (req, res) => {
  const ownerId = req.user!.userId;
  const cacheKey = sessionCacheKeys(0).listOwner(ownerId);
  const sessions = await readCache.getOrSet(cacheKey, async () => {
    const rows = await prisma.session.findMany({
      where: { ownerId },
      include: {
        roles: { orderBy: { position: "asc" } },
        _count: { select: { students: true, groups: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(sessionPayload);
  });
  res.setHeader("Cache-Control", "private, max-age=1");
  res.json({ sessions });
});

sessionRouter.post("/", async (req, res) => {
  const input = sessionSchema.parse(req.body);
  const session = await prisma.session.create({
    data: {
      ownerId: req.user!.userId,
      title: input.title,
      expectedStudentCount: input.expectedStudentCount,
      publicToken: randomUUID().replaceAll("-", ""),
      roles: {
        create: input.roles.map((role, position) => ({ ...role, position })),
      },
    },
    include: { roles: { orderBy: { position: "asc" } } },
  });
  invalidateSessionCaches(session.id, session.publicToken, session.ownerId);
  await writeLog({
    category: "session",
    message: `Session created: ${session.title}`,
    userId: req.user!.userId,
    ip: requestIp(req),
    meta: { sessionId: session.id },
  });
  res.status(201).json({ session: sessionPayload(session) });
});

sessionRouter.get("/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await requireVisibleSession(id, req.user!);
  const cacheKey = sessionCacheKeys(id).detail;
  const session = await readCache.getOrSet(cacheKey, async () => {
    const row = await prisma.session.findUnique({
      where: { id },
      include: {
        roles: {
          orderBy: { position: "asc" },
          include: { _count: { select: { students: true } } },
        },
        students: {
          include: { role: true },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { groups: true } },
      },
    });
    if (!row) throw new HttpError(404, "Session not found");
    return sessionPayload(row);
  });
  res.setHeader("Cache-Control", "private, max-age=1");
  res.json({ session });
});

sessionRouter.put("/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await requireManagedSession(id, req.user!);
  const input = sessionSchema.parse(req.body);
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.session.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!existing) throw new HttpError(404, "Session not found");
    if (existing.status !== SessionStatus.DRAFT) {
      throw new HttpError(409, "Only draft sessions can be edited");
    }
    if (existing._count.students > 0) {
      throw new HttpError(409, "A session with registrations cannot change roles");
    }

    await tx.roleDefinition.deleteMany({ where: { sessionId: id } });
    return tx.session.update({
      where: { id },
      data: {
        title: input.title,
        expectedStudentCount: input.expectedStudentCount,
        roles: { create: input.roles.map((role, position) => ({ ...role, position })) },
      },
      include: { roles: { orderBy: { position: "asc" } } },
    });
  });
  invalidateSessionCaches(updated.id, updated.publicToken, updated.ownerId);
  res.json({ session: sessionPayload(updated) });
});

sessionRouter.delete("/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const session = await requireManagedSession(id, req.user!);
  if (session.status !== SessionStatus.DRAFT) {
    throw new HttpError(409, "Only draft sessions can be deleted");
  }
  await prisma.session.delete({ where: { id } });
  invalidateSessionCaches(session.id, session.publicToken, session.ownerId);
  res.status(204).send();
});

sessionRouter.post("/:id/open", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await requireManagedSession(id, req.user!);
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.session.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Session not found");
    if (existing.status === SessionStatus.OPEN) {
      throw new HttpError(409, "Enrollment is already open");
    }
    if (existing.status === SessionStatus.GROUPED) {
      await tx.generatedGroup.deleteMany({ where: { sessionId: id } });
    }
    return tx.session.update({
      where: { id },
      data: { status: SessionStatus.OPEN },
    });
  });
  invalidateSessionCaches(session.id, session.publicToken, session.ownerId);
  res.json({ session });
});

sessionRouter.post("/:id/close", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await requireManagedSession(id, req.user!);
  const result = await prisma.session.updateMany({
    where: { id, status: SessionStatus.OPEN },
    data: { status: SessionStatus.CLOSED },
  });
  if (result.count === 0) throw new HttpError(409, "Only an open session can be closed");
  const session = await prisma.session.findUniqueOrThrow({ where: { id } });
  invalidateSessionCaches(session.id, session.publicToken, session.ownerId);
  res.json({ session });
});

sessionRouter.delete("/:id/students/:studentId", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const session = await requireManagedSession(id, req.user!);
  const studentId = z.coerce.number().int().positive().parse(req.params.studentId);
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: studentId, sessionId: id },
      select: { id: true },
    });
    if (!student) throw new HttpError(404, "Participant not found");

    await tx.student.delete({ where: { id: studentId } });
    await tx.generatedGroup.deleteMany({
      where: { sessionId: id, members: { none: {} } },
    });
    const remainingGroups = await tx.generatedGroup.count({ where: { sessionId: id } });
    if (remainingGroups === 0) {
      await tx.session.updateMany({
        where: { id, status: SessionStatus.GROUPED },
        data: { status: SessionStatus.CLOSED },
      });
    }
  });
  invalidateSessionCaches(session.id, session.publicToken, session.ownerId);
  res.status(204).send();
});

sessionRouter.post("/:id/shuffle", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const managed = await requireManagedSession(id, req.user!);
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id },
      include: {
        roles: { orderBy: { position: "asc" } },
        students: true,
      },
    });
    if (!session) throw new HttpError(404, "Session not found");
    if (
      session.status !== SessionStatus.CLOSED &&
      session.status !== SessionStatus.GROUPED
    ) {
      throw new HttpError(409, "Close the session before shuffling");
    }
    if (session.students.length === 0) {
      throw new HttpError(409, "At least one participant is required before shuffling");
    }

    const groups = generateGroups(
      session.students.length,
      session.roles,
      session.students,
    );
    await tx.generatedGroup.deleteMany({ where: { sessionId: id } });
    for (const group of groups) {
      await tx.generatedGroup.create({
        data: {
          sessionId: id,
          name: group.name,
          position: group.position,
          members: {
            create: group.members.map((student) => ({
              studentId: student.id,
              roleId: student.roleId,
            })),
          },
        },
      });
    }
    await tx.session.update({
      where: { id },
      data: { status: SessionStatus.GROUPED },
    });
  });

  invalidateSessionCaches(managed.id, managed.publicToken, managed.ownerId);
  const groups = await loadResults(id);
  await writeLog({
    category: "session",
    message: `Session shuffled into ${groups.length} groups`,
    userId: req.user!.userId,
    ip: requestIp(req),
    meta: { sessionId: id, groupCount: groups.length },
  });
  res.json({ groups });
});

sessionRouter.get("/:id/results", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  await requireVisibleSession(id, req.user!);
  const cacheKey = sessionCacheKeys(id).results;
  const groups = await readCache.getOrSet(cacheKey, () => loadResults(id));
  res.setHeader("Cache-Control", "private, max-age=1");
  res.json({ groups });
});

function loadResults(sessionId: number) {
  return prisma.generatedGroup.findMany({
    where: { sessionId },
    orderBy: { position: "asc" },
    include: {
      members: {
        include: { student: true, role: true },
        orderBy: { id: "asc" },
      },
    },
  });
}
