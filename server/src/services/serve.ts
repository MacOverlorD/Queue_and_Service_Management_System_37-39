import { EntryStatus, PrismaClient, QueueEntry } from "@prisma/client";
import { ApiError } from "./queues";

export type ServeAction = "start" | "complete" | "noShow";
export type EntryAction = ServeAction | "cancel";

// Every allowed transition after "call next" (BR-04, BR-11; F-09 adds cancel and no-show, BR-12, BR-13).
const TRANSITIONS: Record<EntryAction, { from: EntryStatus; to: EntryStatus; refused: string }> = {
  start: { from: "CALLED", to: "SERVING", refused: "This ticket cannot be moved to SERVING." },
  complete: { from: "SERVING", to: "COMPLETED", refused: "This ticket cannot be moved to COMPLETED." },
  noShow: { from: "CALLED", to: "NO_SHOW", refused: "Only a called ticket can be marked as no-show." },
  cancel: { from: "WAITING", to: "CANCELLED", refused: "Only a waiting ticket can be cancelled." },
};

export function nextStatus(current: EntryStatus, action: EntryAction): EntryStatus | null {
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

// F-10 open/close (BR-10) and CR-01 waiting limit (BR-15). Entries are untouched; writing the same value is a no-op.
export async function updateQueue(prisma: PrismaClient, queueId: number, data: { isOpen: boolean } | { maxWaiting: number | null }) {
  return prisma.queue.update({ where: { id: queueId }, data, select: { id: true, name: true, isOpen: true, maxWaiting: true } });
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
  const { from, to, refused } = TRANSITIONS[action];
  const now = new Date();
  const times = action === "start" ? { servingAt: now } : action === "complete" ? { completedAt: now } : {};
  const entry = await prisma.$transaction(async (tx) => {
    const { count } = await tx.queueEntry.updateMany({
      where: { id: entryId, status: from },
      data: { status: to, handledByOperatorId: operatorId, ...times },
    });
    if (count === 0) throw new ApiError(409, "INVALID_TRANSITION", refused);
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
    maxWaiting: q.maxWaiting,
    waitingCount: q._count.entries,
    current: q.entries[0] ? { entryId: q.entries[0].id, number: q.entries[0].number, status: q.entries[0].status } : null,
  }));
}

// F-09 cancel: owner only (others look missing, BR-07), WAITING only (BR-12). Locking the queue row first
// serializes with call-next, so a cancel and a call of the same entry cannot both succeed.
export async function cancelEntry(prisma: PrismaClient, entryId: number, customerId: number) {
  const { from, to, refused } = TRANSITIONS.cancel;
  return prisma.$transaction(
    async (tx) => {
      const owned = await tx.queueEntry.findFirst({ where: { id: entryId, customerId }, select: { queueId: true } });
      if (!owned) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
      await tx.$queryRaw`SELECT id FROM "Queue" WHERE id = ${owned.queueId} FOR UPDATE`;
      const { count } = await tx.queueEntry.updateMany({ where: { id: entryId, customerId, status: from }, data: { status: to } });
      if (count === 0) throw new ApiError(409, "INVALID_TRANSITION", refused);
      await tx.entryEvent.create({ data: { entryId, fromStatus: from, toStatus: to, actorId: customerId } });
      return tx.queueEntry.findUniqueOrThrow({ where: { id: entryId }, include: { queue: { select: { name: true } } } });
    },
    { maxWait: 15_000, timeout: 15_000 },
  );
}
