import { Express, RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../auth/session";
import { requireRole } from "../middleware/requireRole";
import {
  queueIdFromEntryParam,
  queueIdFromParam,
  requireQueueOperator,
} from "../middleware/requireQueueOperator";

type Guard = "customer" | "operator" | "operatorOnQueueParam" | "operatorOnEntryParam";
type Method = "get" | "post";

// Route permission matrix of the F-03 contract (section 3). The guards run first; later
// features mount the real handlers after applyRouteAccess(), so a route can never be
// reached without passing its guard. /api/auth/* guards live in the auth router (F-02),
// and the public routes (health, login, display) have no guard.
export const routeAccess: ReadonlyArray<{ method: Method; path: string; guard: Guard }> = [
  { method: "get", path: "/api/queues", guard: "customer" },
  { method: "post", path: "/api/queues/:id/entries", guard: "customer" },
  { method: "get", path: "/api/me/entries", guard: "customer" },
  { method: "get", path: "/api/me/entries/:id", guard: "customer" },
  { method: "get", path: "/api/operator/queues", guard: "operator" },
  { method: "get", path: "/api/queues/:id/entries", guard: "operatorOnQueueParam" },
  { method: "post", path: "/api/queues/:id/call-next", guard: "operatorOnQueueParam" },
  { method: "post", path: "/api/entries/:id/start", guard: "operatorOnEntryParam" },
  { method: "post", path: "/api/entries/:id/complete", guard: "operatorOnEntryParam" },
];

function guardChain(prisma: PrismaClient, guard: Guard): RequestHandler[] {
  const auth = requireAuth(prisma);
  switch (guard) {
    case "customer":
      return [auth, requireRole("CUSTOMER")];
    case "operator":
      return [auth, requireRole("OPERATOR")];
    case "operatorOnQueueParam":
      return [auth, requireRole("OPERATOR"), requireQueueOperator(prisma, queueIdFromParam())];
    case "operatorOnEntryParam":
      return [auth, requireRole("OPERATOR"), requireQueueOperator(prisma, queueIdFromEntryParam(prisma))];
  }
}

export function applyRouteAccess(app: Express, prisma: PrismaClient): void {
  for (const route of routeAccess) {
    app[route.method](route.path, ...guardChain(prisma, route.guard));
  }
}
