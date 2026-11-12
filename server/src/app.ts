import { existsSync } from "node:fs";
import path from "node:path";
import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { authRouter } from "./routes/auth";
import { applyRouteAccess } from "./routes/access";
import { entriesRouter } from "./routes/entries";
import { queuesRouter } from "./routes/queues";
import { displayRouter } from "./routes/display";
import { serveRouter } from "./routes/serve";
import { sendError } from "./http/errors";

// Production: one container serves the API and the built client. cwd is server/ in dev, tests and the image.
const DEFAULT_CLIENT_DIST = path.resolve(process.cwd(), "../client/dist");

export function createApp(prisma: PrismaClient, clientDist: string = DEFAULT_CLIENT_DIST): Express {
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
  // Authorization guards for every protected route (F-03). Feature routers mount after this.
  applyRouteAccess(app, prisma);
  app.use("/api/queues", queuesRouter(prisma));
  // Public routes (no guard): the display exposes only non-private fields (F-07).
  app.use("/api/queues", displayRouter(prisma));
  app.use("/api", entriesRouter(prisma));
  app.use("/api", serveRouter(prisma));

  // Built client (only when present): static files, then index.html for client routes. /api never falls back.
  if (existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api(\/|$)).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
  }

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
