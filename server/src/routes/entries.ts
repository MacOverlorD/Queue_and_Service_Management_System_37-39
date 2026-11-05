import { Router } from "express";
import { EntryStatus, PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { entryView } from "../services/queues";

const ACTIVE_STATUSES: EntryStatus[] = ["WAITING", "CALLED", "SERVING"];
const POSITIVE_INTEGER = /^[1-9]\d*$/;

// Read-only views (F-05). Guards (role, queue assignment) are applied before these handlers by F-03.
export function entriesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/me/entries", async (req, res, next) => {
    try {
      const activeOnly = req.query.status === "active";
      const rows = await prisma.queueEntry.findMany({
        where: { customerId: req.user!.id, ...(activeOnly ? { status: { in: ACTIVE_STATUSES } } : {}) },
        include: { queue: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json({ entries: await Promise.all(rows.map((r) => entryView(prisma, r, r.queue.name))) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/me/entries/:id", async (req, res, next) => {
    try {
      const id = POSITIVE_INTEGER.test(req.params.id) ? Number(req.params.id) : null;
      // Missing, malformed and other customers' entries all look the same (BR-07).
      const row =
        id === null
          ? null
          : await prisma.queueEntry.findFirst({
              where: { id, customerId: req.user!.id },
              include: { queue: { select: { name: true } } },
            });
      if (!row) {
        sendError(res, 404, "NOT_FOUND", "Ticket not found.");
        return;
      }
      res.json({ entry: await entryView(prisma, row, row.queue.name) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/queues/:id/entries", async (req, res, next) => {
    try {
      const queueId = Number(req.params.id); // the F-03 guard already proved this is a valid, assigned queue
      const queue = await prisma.queue.findUniqueOrThrow({
        where: { id: queueId },
        select: { id: true, name: true, isOpen: true },
      });
      const rows = await prisma.queueEntry.findMany({
        where: { queueId, status: { in: ACTIVE_STATUSES } },
        include: { customer: { select: { name: true } } },
        orderBy: { number: "asc" },
      });
      res.json({
        queue,
        entries: rows.map((r) => ({
          id: r.id,
          number: r.number,
          status: r.status,
          customerName: r.customer.name,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
