import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { ApiError, joinQueue, listQueues } from "../services/queues";

export function queuesRouter(prisma: PrismaClient): Router {
  const router = Router();
  // Session and CUSTOMER role are checked by the F-03 guards in routes/access.ts (BR-09).

  router.get("/", async (_req, res, next) => {
    try {
      res.json({ queues: await listQueues(prisma) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/entries", async (req, res, next) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) {
      sendError(res, 400, "VALIDATION_ERROR", "Queue id must be a positive integer.");
      return;
    }
    try {
      res.status(201).json({ entry: await joinQueue(prisma, Number(req.params.id), req.user!.id) });
    } catch (err) {
      if (err instanceof ApiError) {
        sendError(res, err.status, err.code, err.message);
        return;
      }
      next(err);
    }
  });

  return router;
}
