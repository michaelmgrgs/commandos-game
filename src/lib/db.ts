import { PrismaClient } from "@prisma/client";

// Standard Next.js pattern: reuse one Prisma client across hot reloads in dev
// so we don't open a new database connection pool on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
