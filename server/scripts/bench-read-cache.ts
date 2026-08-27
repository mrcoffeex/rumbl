import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { readCache, TtlCache } from "../src/lib/cache";

/**
 * Confirms repeated public-session reads are served from the TTL cache.
 * Usage: npx tsx scripts/bench-read-cache.ts
 */
const prisma = new PrismaClient();

async function time<T>(label: string, run: () => Promise<T>) {
  const start = performance.now();
  const value = await run();
  const ms = performance.now() - start;
  console.log(`${label}: ${ms.toFixed(3)}ms`);
  return { value, ms };
}

async function main() {
  const session = await prisma.session.findFirst({
    where: { publicToken: { not: "" } },
    orderBy: { id: "asc" },
    select: { publicToken: true, id: true },
  });
  if (!session) throw new Error("No session available for cache bench");

  const cache = new TtlCache(1_500);
  const load = async () => {
    const row = await prisma.session.findUnique({
      where: { publicToken: session.publicToken },
      include: {
        roles: {
          orderBy: { position: "asc" },
          include: { _count: { select: { students: true } } },
        },
        _count: { select: { students: true } },
      },
    });
    return row;
  };

  readCache.clear();
  const miss = await time("public session cold (db)", () =>
    cache.getOrSet(`public:session:${session.publicToken}`, load),
  );
  const hit = await time("public session warm (cache)", () =>
    cache.getOrSet(`public:session:${session.publicToken}`, load),
  );
  const hit2 = await time("public session warm x2 (cache)", () =>
    cache.getOrSet(`public:session:${session.publicToken}`, load),
  );

  console.log(
    `\nCache speedup vs cold: ${(miss.ms / Math.max(hit.ms, 0.001)).toFixed(1)}x / ${(miss.ms / Math.max(hit2.ms, 0.001)).toFixed(1)}x`,
  );
  console.log(`Session id=${session.id} token=${session.publicToken.slice(0, 8)}…`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
