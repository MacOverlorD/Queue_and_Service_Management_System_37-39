import { EntryStatus, PrismaClient, QueueEntry } from "@prisma/client";
import { ApiError } from "./queues";

export type ServeAction = "start" | "complete";

// The only Sprint 1 operator transitions after "call next" (BR-04, BR-11).
const TRANSITIONS: Record<ServeAction, { from: EntryStatus; to: EntryStatus }> = {
  start: { from: "CALLED", to: "SERVING" },
  complete: { from: "SERVING", to: "COMPLETED" },
};

export function nextStatus(current: EntryStatus, action: ServeAction): EntryStatus | null {
  return TRANSITIONS[action].from === current ? TRANSITIONS[action].to : null;
}

// Head of the line: lowest ticket number (BR-03, D-07).
export function pickNext<T extends { number: number }>(waiting: T[]): T | null {
  return waiting.reduce<T | null>((best, e) => (best === null || e.number < best.number ? e : best), null);
}

// Operator-facing entry shape (F-06 contract): customer name, never email or hash.
async function operatorView(prisma: PrismaClient, entry: QueueEntry) {
  const customer = await prisma.user.findUniqueOrThrow({ where: { id: entry.customerId }, select: { name: true } });
  return {
    id: entry.id,
    queueId: entry.queueId,
    number: entry.number,
    status: entry.status,
    customerName: customer.name,
    calledAt: entry.calledAt,
    servingAt: entry.servingAt,
    completedAt: entry.completedAt,
  };
}

// Queue-row lock serializes call-next on one queue, so BR-05 (one CALLED/SERVING) holds under concurrency.
export async function callNext(prisma: PrismaClient, queueId: number, operatorId: number) {
  const entry = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Queue" WHERE id = ${queueId} FOR UPDATE`;
      const busy = await tx.queueEntry.count({ where: { queueId, status: { in: ["CALLED", "SERVING"] } } });
      if (busy > 0) throw new ApiError(409, "QUEUE_BUSY", "Finish the current customer before calling the next one.");
      const head = pickNext(await tx.queueEntry.findMany({ where: { queueId, status: "WAITING" }, select: { id: true, number: true } }));
      if (!head) throw new ApiError(409, "NO_WAITING_ENTRY", "Nobody is waiting in this queue.");
      const called = await tx.queueEntry.update({
        where: { id: head.id },
        data: { status: "CALLED", calledAt: new Date(), handledByOperatorId: operatorId },
      });
      await tx.entryEvent.create({ data: { entryId: called.id, fromStatus: "WAITING", toStatus: "CALLED", actorId: operatorId } });
      return called;
    },
    { maxWait: 15_000, timeout: 15_000 },
  );
  return operatorView(prisma, entry);
}

// Conditional update: zero rows means the entry is not in the expected status (or a concurrent request won).
export async function transition(prisma: PrismaClient, entryId: number, action: ServeAction, operatorId: number) {
  const { from, to } = TRANSITIONS[action];
  const now = new Date();
  const entry = await prisma.$transaction(async (tx) => {
    const { count } = await tx.queueEntry.updateMany({
      where: { id: entryId, status: from },
      data: { status: to, handledByOperatorId: operatorId, ...(action === "start" ? { servingAt: now } : { completedAt: now }) },
    });
    if (count === 0) throw new ApiError(409, "INVALID_TRANSITION", `This ticket cannot be moved to ${to}.`);
    await tx.entryEvent.create({ data: { entryId, fromStatus: from, toStatus: to, actorId: operatorId } });
    return tx.queueEntry.findUniqueOrThrow({ where: { id: entryId } });
  });
  return operatorView(prisma, entry);
}

export async function operatorQueues(prisma: PrismaClient, operatorId: number) {
  const queues = await prisma.queue.findMany({
    where: { operators: { some: { userId: operatorId } } },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { entries: { where: { status: "WAITING" } } } },
      entries: { where: { status: { in: ["CALLED", "SERVING"] } }, take: 1, select: { id: true, number: true, status: true } },
    },
  });
  return queues.map((q) => ({
    id: q.id,
    name: q.name,
    isOpen: q.isOpen,
    waitingCount: q._count.entries,
    current: q.entries[0] ? { entryId: q.entries[0].id, number: q.entries[0].number, status: q.entries[0].status } : null,
  }));
}
