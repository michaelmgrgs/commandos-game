// Creates the first admin account from your .env settings.
// Run with: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "Admin";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists for ${email} — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: { name, email, passwordHash, role: "GAME_MASTER" },
  });

  console.log(`Created admin account: ${email}`);
  console.log(`Log in at /admin/login with that email and the password from your .env file.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
