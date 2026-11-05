import { Router } from "express";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { sendError } from "../http/errors";
import { SESSION_COOKIE, cookieOptions, createSession, requireAuth, sessionTtlMs } from "../auth/session";

const INVALID_LOGIN = "Invalid email or password.";
// Compared when the email is unknown, so both failure paths cost one bcrypt compare (cost 10, like the seed).
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export function authRouter(prisma: PrismaClient): Router {
  const router = Router();
  const auth = requireAuth(prisma);

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
        sendError(res, 400, "VALIDATION_ERROR", "Email and password are required.");
        return;
      }
      // Emails are stored lowercase, and User.email is case-sensitive in PostgreSQL.
      const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      // Unknown email and wrong password give the same answer (AC-F02-03).
      const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !passwordOk) {
        sendError(res, 401, "INVALID_CREDENTIALS", INVALID_LOGIN);
        return;
      }
      const session = await createSession(prisma, user.id);
      res.cookie(SESSION_COOKIE, session.id, { ...cookieOptions(), maxAge: sessionTtlMs() });
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", auth, async (req, res, next) => {
    try {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", auth, async (req, res, next) => {
    try {
      await prisma.session.deleteMany({ where: { id: req.sessionId } });
      res.clearCookie(SESSION_COOKIE, cookieOptions());
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
