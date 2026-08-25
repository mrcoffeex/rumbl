import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = (process.env.ADMIN_EMAIL || (username?.includes("@") ? username : username ? `${username}@rumbl.local` : "")).toLocaleLowerCase();

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL or ADMIN_USERNAME, and ADMIN_PASSWORD are required to seed the admin");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", name: username || "Admin" },
    create: { email, name: username || "Admin", passwordHash, role: "ADMIN" },
  });

  console.log(`Seeded admin "${email}"`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
