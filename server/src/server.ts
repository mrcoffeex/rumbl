import { app } from "./app";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";

const server = app.listen(env.PORT, () => {
  console.log(`Rumbl API listening on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
