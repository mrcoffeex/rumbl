import { createHash, randomBytes } from "node:crypto";
import { PrismaClient, SessionStatus, UserRole, UserStatus } from "@prisma/client";

/**
 * Seeds a large-ish dataset and prints EXPLAIN ANALYZE for the hot read queries.
 * Usage: npx tsx scripts/bench-hot-queries.ts
 */
const prisma = new PrismaClient();

async function explain(label: string, sql: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
  );
  const plan = rows.map((row) => row["QUERY PLAN"]).join("\n");
  const timing = plan.match(/Execution Time: ([\d.]+) ms/);
  const planning = plan.match(/Planning Time: ([\d.]+) ms/);
  console.log(`\n=== ${label} ===`);
  console.log(
    `planning=${planning?.[1] ?? "?"}ms execution=${timing?.[1] ?? "?"}ms`,
  );
  console.log(plan);
  return {
    label,
    planningMs: Number(planning?.[1] ?? NaN),
    executionMs: Number(timing?.[1] ?? NaN),
    usedIndex: /Index Scan|Index Only Scan|Bitmap Index Scan/.test(plan),
    seqScan: /Seq Scan/.test(plan),
  };
}

async function seedLoad() {
  const existing = await prisma.student.count();
  if (existing >= 5_000) {
    console.log(`Dataset already loaded (${existing} students).`);
    return;
  }

  console.log("Seeding benchmark dataset…");
  const passwordHash = createHash("sha256").update("bench").digest("hex");

  const owners = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      prisma.user.create({
        data: {
          email: `bench-owner-${i}@rumbl.local`,
          name: `Bench Owner ${i}`,
          passwordHash,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      }),
    ),
  );

  for (const owner of owners) {
    for (let s = 0; s < 5; s += 1) {
      const token = randomBytes(16).toString("hex");
      const session = await prisma.session.create({
        data: {
          ownerId: owner.id,
          title: `Bench ${owner.id}-${s}`,
          expectedStudentCount: 120,
          publicToken: token,
          status: s % 2 === 0 ? SessionStatus.OPEN : SessionStatus.GROUPED,
          roles: {
            create: [
              { name: "Coder", slotsPerGroup: 1, position: 0 },
              { name: "Designer", slotsPerGroup: 1, position: 1 },
              { name: "Researcher", slotsPerGroup: 1, position: 2 },
            ],
          },
        },
        include: { roles: true },
      });

      const students = Array.from({ length: 80 }, (_, i) => ({
        sessionId: session.id,
        roleId: session.roles[i % session.roles.length]!.id,
        name: `Student ${owner.id}-${s}-${i}`,
      }));
      await prisma.student.createMany({ data: students });

      if (session.status === SessionStatus.GROUPED) {
        const created = await prisma.student.findMany({
          where: { sessionId: session.id },
          select: { id: true, roleId: true },
          orderBy: { id: "asc" },
        });
        for (let g = 0; g < 20; g += 1) {
          const members = created.slice(g * 3, g * 3 + 3);
          if (!members.length) break;
          await prisma.generatedGroup.create({
            data: {
              sessionId: session.id,
              name: `Group ${g + 1}`,
              position: g,
              members: {
                create: members.map((member) => ({
                  studentId: member.id,
                  roleId: member.roleId,
                })),
              },
            },
          });
        }
      }
    }
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  await prisma.trafficEvent.createMany({
    data: Array.from({ length: 2_000 }, (_, i) => ({
      method: "GET",
      path: i % 3 === 0 ? "/api/public/sessions/x" : "/api/sessions",
      status: i % 17 === 0 ? 500 : 200,
      durationMs: 10 + (i % 40),
      createdAt: new Date(since.getTime() + i * 60_000),
    })),
  });
  await prisma.systemLog.createMany({
    data: Array.from({ length: 500 }, (_, i) => ({
      level: i % 5 === 0 ? "error" : "info",
      category: "bench",
      message: `bench log ${i}`,
      createdAt: new Date(since.getTime() + i * 120_000),
    })),
  });

  console.log("Seed complete.", {
    users: await prisma.user.count(),
    sessions: await prisma.session.count(),
    students: await prisma.student.count(),
  });
}

async function main() {
  await seedLoad();

  const owner = await prisma.user.findFirst({
    where: { email: { startsWith: "bench-owner-" } },
    orderBy: { id: "asc" },
  });
  if (!owner) throw new Error("Missing bench owner");

  const session = await prisma.session.findFirst({
    where: { ownerId: owner.id, status: SessionStatus.GROUPED },
    orderBy: { id: "asc" },
  });
  if (!session) throw new Error("Missing bench session");

  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const results = [
    await explain(
      "owner session list (filter ownerId, order createdAt desc)",
      `SELECT id FROM "Session" WHERE "ownerId" = ${owner.id} ORDER BY "createdAt" DESC`,
    ),
    await explain(
      "admin sessions (order createdAt desc)",
      `SELECT id FROM "Session" ORDER BY "createdAt" DESC LIMIT 500`,
    ),
    await explain(
      "session students ordered by createdAt",
      `SELECT id FROM "Student" WHERE "sessionId" = ${session.id} ORDER BY "createdAt" ASC`,
    ),
    await explain(
      "role student count via roleId",
      `SELECT COUNT(*) FROM "Student" WHERE "roleId" = (SELECT id FROM "RoleDefinition" WHERE "sessionId" = ${session.id} LIMIT 1)`,
    ),
    await explain(
      "admin overview error logs (level + createdAt)",
      `SELECT COUNT(*) FROM "SystemLog" WHERE "createdAt" >= '${sinceIso}' AND level = 'error'`,
    ),
    await explain(
      "session groupBy status",
      `SELECT status, COUNT(*) FROM "Session" GROUP BY status`,
    ),
    await explain(
      "users ordered by createdAt",
      `SELECT id FROM "User" ORDER BY "createdAt" DESC`,
    ),
    await explain(
      "active admin count (role + status)",
      `SELECT COUNT(*) FROM "User" WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
    ),
  ];

  console.log("\n=== Summary ===");
  for (const row of results) {
    console.log(
      `${row.label}: exec=${row.executionMs}ms index=${row.usedIndex} seq=${row.seqScan}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
