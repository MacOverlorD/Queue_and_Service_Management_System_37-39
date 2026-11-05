import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// Creates a session row directly in the database and returns the cookie header value.
// F-03 tests use this so they do not depend on the login route's behavior (F-02).
export async function sessionCookie(
  prisma: PrismaClient,
  email: string,
  options: { expiresInMs?: number } = {},
): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const id = randomBytes(32).toString("base64url");
  const ttl = options.expiresInMs ?? 60 * 60 * 1000;
  await prisma.session.create({ data: { id, userId: user.id, expiresAt: new Date(Date.now() + ttl) } });
  return `sid=${id}`;
}

export async function snapshotEntries(prisma: PrismaClient) {
  const entries = await prisma.queueEntry.findMany({
    select: { id: true, status: true, queueId: true, number: true },
    orderBy: { id: "asc" },
  });
  const events = await prisma.entryEvent.count();
  const queues = await prisma.queue.findMany({ select: { id: true, lastNumber: true }, orderBy: { id: "asc" } });
  return { entries, events, queues };
}
