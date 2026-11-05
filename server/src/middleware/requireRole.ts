import { NextFunction, Request, RequestHandler, Response } from "express";
import { Role } from "@prisma/client";
import { sendError } from "../http/errors";

// Role check on the server (BR-09). requireAuth must run first and set req.user.
export function requireRole(role: Role): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, 401, "UNAUTHENTICATED", "Please log in.");
      return;
    }
    if (req.user.role !== role) {
      sendError(res, 403, "FORBIDDEN_ROLE", "You are not allowed to do this.");
      return;
    }
    next();
  };
}
