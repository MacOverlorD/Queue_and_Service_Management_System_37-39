import { Response } from "express";

// Shared error shape for every API error (Sprint 1 contracts, shared conventions).
export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}
