import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

// Public queue display (F-07, FR-12 API part, BR-08). No session is required, so the handler
// selects only safe fields: queue name, open flag, the current number and the waiting count.
// No customer name, email, user id or entry id is ever read into the response.
export function displayRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:id/display", async (req, res, next) => {
    try {
      const id = POSITIVE_INTEGER.test(req.params.id) ? Number(req.params.id) : null;
      const queue =
        id === null ? null : await prisma.queue.findUnique({ where: { id }, select: { id: true, name: true, isOpen: true } });
      if (!queue) {
        sendError(res, 404, "NOT_FOUND", "Queue not found.");
        return;
      }
      const [current, waitingCount] = await Promise.all([
        prisma.queueEntry.findFirst({
          where: { queueId: queue.id, status: { in: ["CALLED", "SERVING"] } },
          select: { number: true, status: true },
        }),
        prisma.queueEntry.count({ where: { queueId: queue.id, status: "WAITING" } }),
      ]);
      res.json({
        queueId: queue.id,
        queueName: queue.name,
        isOpen: queue.isOpen,
        currentNumber: current?.number ?? null,
        currentStatus: current?.status ?? null,
        waitingCount,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
