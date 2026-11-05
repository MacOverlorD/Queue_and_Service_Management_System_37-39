import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../prisma/seed";

export function newPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
}

export async function queueByName(prisma: PrismaClient, name: string) {
  return prisma.queue.findUniqueOrThrow({ where: { name } });
}

export async function userByEmail(prisma: PrismaClient, email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}

// Reset every table and reseed, so each test file starts from the documented seed state.
export async function resetAndSeed(prisma: PrismaClient): Promise<void> {
  // Safety: only ever wipe a database whose name marks it as a test database.
  const url = process.env.DATABASE_URL ?? "";
  if (!/\/[^/?]*test[^/?]*(\?|$)/.test(url)) {
    throw new Error("resetAndSeed refused: DATABASE_URL does not point to a test database");
  }
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "EntryEvent", "QueueEntry", "OperatorQueue", "Session", "Queue", "User" RESTART IDENTITY CASCADE',
  );
  await seedDatabase(prisma);
}
