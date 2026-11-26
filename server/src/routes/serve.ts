import { NextFunction, Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { ApiError } from "../services/queues";
import { callNext, operatorQueues, transition, updateQueue } from "../services/serve";

// Operator serve workflow (F-06). Session, OPERATOR role and queue assignment are checked by the
// F-03 guards in routes/access.ts, which also reject malformed ids, so params here are valid integers.
export function serveRouter(prisma: PrismaClient): Router {
  const router = Router();

  async function reply(res: Response, next: NextFunction, work: () => Promise<unknown>) {
    try {
      res.json(await work());
    } catch (err) {
      if (err instanceof ApiError) {
        sendError(res, err.status, err.code, err.message);
        return;
      }
      next(err);
    }
  }

  router.get("/operator/queues", (req, res, next) =>
    reply(res, next, async () => ({ queues: await operatorQueues(prisma, req.user!.id) })),
  );
  // F-10 / CR-01: body is exactly { isOpen: boolean } or exactly { maxWaiting: 1..200 | null };
  // the guard already proved the queue is assigned to the caller.
  router.patch("/queues/:id", (req, res, next) => {
    const body = req.body as Record<string, unknown> | undefined;
    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    const id = Number(req.params.id);
    if (keys.length === 1 && keys[0] === "maxWaiting") {
      const m = body!.maxWaiting;
      if (m !== null && !(Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 200)) {
        sendError(res, 400, "VALIDATION_ERROR", "maxWaiting must be a whole number from 1 to 200, or null.");
        return;
      }
      return reply(res, next, async () => ({ queue: await updateQueue(prisma, id, { maxWaiting: m as number | null }) }));
    }
    if (keys.length !== 1 || typeof body!.isOpen !== "boolean") {
      sendError(res, 400, "VALIDATION_ERROR", "isOpen must be true or false.");
      return;
    }
    return reply(res, next, async () => ({ queue: await updateQueue(prisma, id, { isOpen: body!.isOpen as boolean }) }));
  });
  router.post("/queues/:id/call-next", (req, res, next) =>
    reply(res, next, async () => ({ entry: await callNext(prisma, Number(req.params.id), req.user!.id) })),
  );
  for (const [path, action] of [["start", "start"], ["complete", "complete"], ["no-show", "noShow"]] as const) {
    router.post(`/entries/:id/${path}`, (req, res, next) =>
      reply(res, next, async () => ({ entry: await transition(prisma, Number(req.params.id), action, req.user!.id) })),
    );
  }

  return router;
}
