import { NextFunction, Request, RequestHandler, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";

export type QueueIdResolver = (req: Request) => Promise<number | null>;

const POSITIVE_INTEGER = /^[1-9]\d*$/;

function positiveInt(value: unknown): number | null {
  return typeof value === "string" && POSITIVE_INTEGER.test(value) ? Number(value) : null;
}

// Queue id taken from the route parameter, e.g. /api/queues/:id/...
export function queueIdFromParam(name = "id"): QueueIdResolver {
  return async (req) => positiveInt(req.params[name]);
}

// Queue id of the entry in the route parameter, e.g. /api/entries/:id/start
export function queueIdFromEntryParam(prisma: PrismaClient, name = "id"): QueueIdResolver {
  return async (req) => {
    const entryId = positiveInt(req.params[name]);
    if (entryId === null) return null;
    const entry = await prisma.queueEntry.findUnique({ where: { id: entryId }, select: { queueId: true } });
    return entry?.queueId ?? null;
  };
}

// An operator may act only on queues assigned to them (BR-06). Unknown, malformed and
// unassigned queues all give the same 403 so the existence of a queue is not revealed.
export function requireQueueOperator(prisma: PrismaClient, resolveQueueId: QueueIdResolver): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
        return;
      }
      const queueId = await resolveQueueId(req);
      const link =
        queueId === null
          ? null
          : await prisma.operatorQueue.findUnique({
              where: { userId_queueId: { userId: req.user.id, queueId } },
            });
      if (!link) {
        sendError(res, 403, "FORBIDDEN_QUEUE", "You are not allowed to use this queue.");
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
