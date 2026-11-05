import { PrismaClient } from "@prisma/client";

export function newPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
}

export async function queueByName(prisma: PrismaClient, name: string) {
  return prisma.queue.findUniqueOrThrow({ where: { name } });
}

export async function userByEmail(prisma: PrismaClient, email: string) {
  return prisma.user.findUniqueOrThrow({ where: { email } });
}
