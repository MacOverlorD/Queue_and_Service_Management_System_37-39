import { NextFunction, Response, Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { ApiError } from "../services/queues";
import { callNext, operatorQueues, transition } from "../services/serve";

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
  router.post("/queues/:id/call-next", (req, res, next) =>
    reply(res, next, async () => ({ entry: await callNext(prisma, Number(req.params.id), req.user!.id) })),
  );
  for (const action of ["start", "complete"] as const) {
    router.post(`/entries/:id/${action}`, (req, res, next) =>
      reply(res, next, async () => ({ entry: await transition(prisma, Number(req.params.id), action, req.user!.id) })),
    );
  }

  return router;
}
