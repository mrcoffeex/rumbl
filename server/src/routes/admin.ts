import { randomUUID } from "node:crypto";
import { Router } from "express";
import { SessionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { calculateCapacity, generateGroups } from "../lib/grouping";
import { requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/errors";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const roleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slotsPerGroup: z.number().int().min(1).max(100),
});

const sessionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    expectedStudentCount: z.number().int().min(1).max(100_000),
    roles: z.array(roleSchema).min(1).max(100),
  })
  .superRefine((value, context) => {
    const names = value.roles.map((role) => role.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      context.addIssue({ code: "custom", message: "Role names must be unique", path: ["roles"] });
    }
    const groupSize = value.roles.reduce((sum, role) => sum + role.slotsPerGroup, 0);
    if (value.expectedStudentCount < groupSize) {
      context.addIssue({
        code: "custom",
        message: "Expected count must accommodate at least one complete group",
        path: ["expectedStudentCount"],
      });
    }
  });

function sessionPayload<T extends {
  expectedStudentCount: number;
  roles: Array<{ id: number; name: string; slotsPerGroup: number }>;
}>(session: T) {
  return {
    ...session,
    capacity: calculateCapacity(session.expectedStudentCount, session.roles),
  };
}

adminRouter.get("/sessions", async (_req, res) => {
  const sessions = await prisma.session.findMany({
    include: {
      roles: { orderBy: { position: "asc" } },
      _count: { select: { students: true, groups: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ sessions: sessions.map(sessionPayload) });
});

adminRouter.post("/sessions", async (req, res) => {
  const input = sessionSchema.parse(req.body);
  const session = await prisma.session.create({
    data: {
      title: input.title,
      expectedStudentCount: input.expectedStudentCount,
      publicToken: randomUUID().replaceAll("-", ""),
      roles: {
        create: input.roles.map((role, position) => ({ ...role, position })),
      },
    },
    include: { roles: { orderBy: { position: "asc" } } },
  });
  res.status(201).json({ session: sessionPayload(session) });
});

adminRouter.get("/sessions/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const session = await prisma.session.findUnique({
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
  if (!session) throw new HttpError(404, "Session not found");
  res.json({ session: sessionPayload(session) });
});

adminRouter.put("/sessions/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
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
  res.json({ session: sessionPayload(updated) });
});

adminRouter.delete("/sessions/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) throw new HttpError(404, "Session not found");
  if (session.status !== SessionStatus.DRAFT) {
    throw new HttpError(409, "Only draft sessions can be deleted");
  }
  await prisma.session.delete({ where: { id } });
  res.status(204).send();
});

adminRouter.post("/sessions/:id/open", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
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
  res.json({ session });
});

adminRouter.post("/sessions/:id/close", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const result = await prisma.session.updateMany({
    where: { id, status: SessionStatus.OPEN },
    data: { status: SessionStatus.CLOSED },
  });
  if (result.count === 0) throw new HttpError(409, "Only an open session can be closed");
  const session = await prisma.session.findUniqueOrThrow({ where: { id } });
  res.json({ session });
});

adminRouter.post("/sessions/:id/shuffle", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
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

  const groups = await loadResults(id);
  res.json({ groups });
});

adminRouter.get("/sessions/:id/results", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) throw new HttpError(404, "Session not found");
  res.json({ groups: await loadResults(id) });
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
