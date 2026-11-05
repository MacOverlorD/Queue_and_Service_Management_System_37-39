import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { authRouter } from "./routes/auth";
import { sendError } from "./http/errors";

export function createApp(prisma: PrismaClient): Express {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", credentials: true }));
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", db: "up" });
    } catch {
      res.status(503).json({ error: { code: "DB_UNAVAILABLE", message: "Database is not reachable." } });
    }
  });

  app.use("/api/auth", authRouter(prisma));

  // Last resort: never leak stack traces or SQL to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((err as { type?: string })?.type === "entity.parse.failed") {
      sendError(res, 400, "VALIDATION_ERROR", "Request body is not valid JSON.");
      return;
    }
    console.error(err);
    sendError(res, 500, "INTERNAL_ERROR", "Something went wrong.");
  });

  return app;
}
