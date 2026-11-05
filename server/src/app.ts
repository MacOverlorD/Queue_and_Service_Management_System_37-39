import express, { Express } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

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

  return app;
}
