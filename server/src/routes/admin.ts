import { Router } from "express";
import bcrypt from "bcryptjs";
import { SessionStatus, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requestIp, writeLog } from "../lib/logging";
import { requireAdmin } from "../middleware/auth";
import { HttpError } from "../middleware/errors";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(190)
  .transform((value) => value.toLocaleLowerCase());
const passwordSchema = z.string().min(8).max(200);
const roleSchema = z.enum(["user", "admin"]);
const statusSchema = z.enum(["active", "disabled"]);

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function hourKey(date: Date) {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy.toISOString();
}

function lastDayKeys(days: number) {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, index) =>
    new Date(start - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
}

function lastHourKeys(hours: number) {
  const now = new Date();
  now.setUTCMinutes(0, 0, 0);
  return Array.from({ length: hours }, (_, index) => {
    const hour = new Date(now.getTime() - (hours - 1 - index) * 60 * 60 * 1000);
    return hour.toISOString();
  });
}

function publicAdminUser(user: {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  googleId: string | null;
  passwordHash: string | null;
  createdAt: Date;
  _count: { sessions: number };
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role === UserRole.ADMIN ? "admin" : "user",
    status: user.status === UserStatus.DISABLED ? "disabled" : "active",
    google: Boolean(user.googleId),
    hasPassword: Boolean(user.passwordHash),
    sessionCount: user._count.sessions,
    createdAt: user.createdAt,
  };
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  googleId: true,
  passwordHash: true,
  createdAt: true,
  _count: { select: { sessions: true } },
} as const;

async function activeAdminCount(exceptId?: number) {
  return prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
}

adminRouter.get("/overview", async (_req, res) => {
  const since24h = new Date(Date.now() - DAY_MS);
  const since14d = new Date(Date.now() - 14 * DAY_MS);
  const [
    users,
    admins,
    sessions,
    students,
    requests24h,
    errors24h,
    sessionsByStatus,
    traffic,
    signups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.session.count(),
    prisma.student.count(),
    prisma.trafficEvent.count({ where: { createdAt: { gte: since24h } } }),
    prisma.systemLog.count({ where: { createdAt: { gte: since24h }, level: "error" } }),
    prisma.session.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.trafficEvent.findMany({
      where: { createdAt: { gte: since14d } },
      select: { createdAt: true, status: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since14d } },
      select: { createdAt: true },
    }),
  ]);

  const trafficByDay = new Map<string, { requests: number; errors: number }>();
  const statusBuckets = { "2xx": 0, "4xx": 0, "5xx": 0, other: 0 };
  const hourly = new Map<string, number>();
  for (const event of traffic) {
    const day = dayKey(event.createdAt);
    const current = trafficByDay.get(day) ?? { requests: 0, errors: 0 };
    current.requests += 1;
    if (event.status >= 500) current.errors += 1;
    trafficByDay.set(day, current);
    if (event.status >= 200 && event.status < 300) statusBuckets["2xx"] += 1;
    else if (event.status >= 400 && event.status < 500) statusBuckets["4xx"] += 1;
    else if (event.status >= 500) statusBuckets["5xx"] += 1;
    else statusBuckets.other += 1;
    if (event.createdAt >= since24h) {
      const hour = hourKey(event.createdAt);
      hourly.set(hour, (hourly.get(hour) ?? 0) + 1);
    }
  }

  const signupsByDay = new Map<string, number>();
  for (const user of signups) {
    const day = dayKey(user.createdAt);
    signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
  }

  const statusCounts = Object.fromEntries(
    sessionsByStatus.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<SessionStatus, number>>;

  res.json({
    overview: { users, admins, sessions, students, requests24h, errors24h },
    charts: {
      trafficByDay: lastDayKeys(14).map((date) => ({
        date,
        requests: trafficByDay.get(date)?.requests ?? 0,
        errors: trafficByDay.get(date)?.errors ?? 0,
      })),
      signupsByDay: lastDayKeys(14).map((date) => ({
        date,
        users: signupsByDay.get(date) ?? 0,
      })),
      hourlyTraffic: lastHourKeys(24).map((hour) => ({
        hour,
        requests: hourly.get(hour) ?? 0,
      })),
      sessionsByStatus: (["DRAFT", "OPEN", "CLOSED", "GROUPED"] as SessionStatus[]).map(
        (status) => ({ status: status.toLowerCase(), count: statusCounts[status] ?? 0 }),
      ),
      requestsByStatus: [
        { bucket: "2xx", count: statusBuckets["2xx"] },
        { bucket: "4xx", count: statusBuckets["4xx"] },
        { bucket: "5xx", count: statusBuckets["5xx"] },
      ],
    },
  });
});

adminRouter.get("/traffic", async (req, res) => {
  const take = z.coerce.number().int().min(1).max(200).optional().parse(req.query.limit) ?? 50;
  const events = await prisma.trafficEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true, name: true, role: true } } },
  });
  res.json({ events });
});

adminRouter.get("/logs", async (req, res) => {
  const take = z.coerce.number().int().min(1).max(200).optional().parse(req.query.limit) ?? 50;
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { user: { select: { email: true, name: true, role: true } } },
  });
  res.json({ logs });
});

adminRouter.get("/sessions", async (_req, res) => {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      owner: { select: { id: true, email: true, name: true } },
      _count: { select: { students: true, groups: true } },
    },
  });
  res.json({ sessions });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: userSelect,
  });
  res.json({ users: users.map(publicAdminUser) });
});

adminRouter.post("/users", async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(1).max(120),
      email: emailSchema,
      password: passwordSchema,
      role: roleSchema.default("user"),
    })
    .parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new HttpError(409, "An account with that email already exists");

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: input.role === "admin" ? UserRole.ADMIN : UserRole.USER,
    },
    select: userSelect,
  });

  await writeLog({
    category: "admin",
    message: `Created user ${user.email} (${user.role})`,
    userId: req.user?.userId,
    ip: requestIp(req),
  });
  res.status(201).json({ user: publicAdminUser(user) });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const input = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      email: emailSchema.optional(),
      password: passwordSchema.optional(),
      role: roleSchema.optional(),
      status: statusSchema.optional(),
    })
    .parse(req.body);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "User not found");

  if (input.email && input.email !== existing.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw new HttpError(409, "An account with that email already exists");
  }

  const nextRole = input.role === "admin" ? UserRole.ADMIN : input.role === "user" ? UserRole.USER : existing.role;
  const nextStatus = input.status === "disabled" ? UserStatus.DISABLED : input.status === "active" ? UserStatus.ACTIVE : existing.status;
  const self = existing.id === req.user?.userId;
  const wouldRemainAdmin = nextRole === UserRole.ADMIN && nextStatus === UserStatus.ACTIVE;

  if (self && (nextRole !== UserRole.ADMIN || nextStatus !== UserStatus.ACTIVE)) {
    throw new HttpError(409, "You cannot demote or disable your own account");
  }

  if (existing.role === UserRole.ADMIN && existing.status === UserStatus.ACTIVE && !wouldRemainAdmin) {
    if ((await activeAdminCount(existing.id)) < 1) {
      throw new HttpError(409, "The last active administrator cannot be demoted or disabled");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: input.name,
      email: input.email,
      role: nextRole,
      status: nextStatus,
      passwordHash: input.password ? await bcrypt.hash(input.password, 12) : undefined,
    },
    select: userSelect,
  });

  await writeLog({
    category: "admin",
    message: `Updated user ${user.email} (${user.role}, ${user.status})`,
    userId: req.user?.userId,
    ip: requestIp(req),
  });
  res.json({ user: publicAdminUser(user) });
});

adminRouter.delete("/users/:id", async (req, res) => {
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "User not found");
  if (existing.id === req.user?.userId) {
    throw new HttpError(409, "You cannot delete your own account");
  }
  if (existing.role === UserRole.ADMIN && existing.status === UserStatus.ACTIVE) {
    if ((await activeAdminCount(existing.id)) < 1) {
      throw new HttpError(409, "The last active administrator cannot be deleted");
    }
  }

  await prisma.user.delete({ where: { id } });
  await writeLog({
    category: "admin",
    message: `Deleted user ${existing.email}`,
    userId: req.user?.userId,
    ip: requestIp(req),
  });
  res.status(204).send();
});
