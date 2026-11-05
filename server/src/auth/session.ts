import { randomBytes } from "node:crypto";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { sendError } from "../http/errors";

export const SESSION_COOKIE = "sid";

export type AuthUser = { id: number; name: string; role: Role };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
    }
  }
}

export function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 8);
  return (Number.isFinite(hours) && hours > 0 ? hours : 8) * 60 * 60 * 1000;
}

// A session whose expiry time has been reached is no longer valid (TEST-F02-06b).
export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export async function createSession(prisma: PrismaClient, userId: number) {
  return prisma.session.create({
    data: {
      id: randomBytes(32).toString("base64url"),
      userId,
      expiresAt: new Date(Date.now() + sessionTtlMs()),
    },
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function readSessionId(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    // Session ids are base64url, so no decoding is needed; a malformed value just matches no session (401).
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

// F-02: turns the sid cookie into req.user. F-03 reuses it on every protected route.
export function requireAuth(prisma: PrismaClient): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sid = readSessionId(req);
      const session = sid
        ? await prisma.session.findUnique({ where: { id: sid }, include: { user: true } })
        : null;
      if (!session) {
        sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
        return;
      }
      if (isSessionExpired(session.expiresAt)) {
        await prisma.session.deleteMany({ where: { id: session.id } });
        sendError(res, 401, "UNAUTHENTICATED", "Your session has expired. Please log in again.");
        return;
      }
      req.user = { id: session.user.id, name: session.user.name, role: session.user.role };
      req.sessionId = session.id;
      next();
    } catch (err) {
      next(err);
    }
  };
}
