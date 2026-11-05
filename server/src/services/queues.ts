import { Prisma, PrismaClient, QueueEntry } from "@prisma/client";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function listQueues(prisma: PrismaClient) {
  const queues = await prisma.queue.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { entries: { where: { status: "WAITING" } } } } },
  });
  return queues.map((q) => ({
    id: q.id,
    name: q.name,
    serviceName: q.serviceName,
    isOpen: q.isOpen,
    waitingCount: q._count.entries,
  }));
}

// Customer-facing entry shape, shared with F-05 (GET /api/me/entries).
export async function entryView(prisma: PrismaClient, entry: QueueEntry, queueName: string) {
  const peopleAhead =
    entry.status === "WAITING"
      ? await prisma.queueEntry.count({
          where: { queueId: entry.queueId, status: "WAITING", number: { lt: entry.number } },
        })
      : null;
  return {
    id: entry.id,
    queueId: entry.queueId,
    queueName,
    number: entry.number,
    status: entry.status,
    peopleAhead,
    createdAt: entry.createdAt,
  };
}

// D-12: the counter UPDATE locks the queue row, so concurrent joins get distinct numbers.
// D-13: the partial unique index rejects a second active entry; the rollback keeps lastNumber unchanged.
export async function joinQueue(prisma: PrismaClient, queueId: number, customerId: number) {
  try {
    const { entry, queueName } = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ lastNumber: number; name: string }[]>`
          UPDATE "Queue" SET "lastNumber" = "lastNumber" + 1
          WHERE id = ${queueId} AND "isOpen" = true
          RETURNING "lastNumber", name`;
        if (rows.length === 0) {
          const exists = await tx.queue.findUnique({ where: { id: queueId }, select: { id: true } });
          throw exists
            ? new ApiError(409, "QUEUE_CLOSED", "This queue is closed for new tickets.")
            : new ApiError(404, "NOT_FOUND", "Queue not found.");
        }
        const entry = await tx.queueEntry.create({
          data: { queueId, customerId, number: rows[0].lastNumber, status: "WAITING" },
        });
        await tx.entryEvent.create({
          data: { entryId: entry.id, fromStatus: null, toStatus: "WAITING", actorId: customerId },
        });
        return { entry, queueName: rows[0].name };
      },
      // Concurrent joins wait on the row lock; the defaults (2 s wait, 5 s run) are too short under load.
      { maxWait: 15_000, timeout: 15_000 },
    );
    return entryView(prisma, entry, queueName);
  } catch (err) {
    // Only the D-13 index (queueId, customerId) means "already in the queue"; a (queueId, number)
    // collision is a counter bug and must surface as a logged 500, not a false 409.
    const target = err instanceof Prisma.PrismaClientKnownRequestError ? err.meta?.target : undefined;
    if ((err as { code?: string }).code === "P2002" && Array.isArray(target) && target.includes("customerId")) {
      throw new ApiError(409, "DUPLICATE_ACTIVE_ENTRY", "You already have an active ticket in this queue.");
    }
    throw err;
  }
}
