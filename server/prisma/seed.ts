import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required to seed the admin");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });

  console.log(`Seeded admin "${username}"`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
