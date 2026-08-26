import { app } from "./app";
import { checkDatabase } from "./lib/database";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";

async function start() {
  const connected = await checkDatabase();
  if (connected) {
    console.log("Database connected");
  } else {
    console.error(
      "Database connection failed. Check DATABASE_URL and that MySQL is running. The API will start and return 503 until the database is reachable.",
    );
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Rumbl API listening on port ${env.PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect().catch(() => undefined);
      process.exit(0);
    });
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void start();
