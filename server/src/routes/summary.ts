import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { isValidDate, queueSummary } from "../services/summary";

// Service summary (F-13, FR-20). The F-03 guard already proved the caller is an operator assigned to this queue.
export function summaryRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:id/summary", async (req, res, next) => {
    try {
      const date = req.query.date;
      if (!isValidDate(date)) {
        sendError(res, 400, "VALIDATION_ERROR", "Use date=YYYY-MM-DD.");
        return;
      }
      const queue = await prisma.queue.findUniqueOrThrow({
        where: { id: Number(req.params.id) },
        select: { id: true, name: true },
      });
      res.json(await queueSummary(prisma, queue.id, queue.name, date));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
