import { PrismaClient } from "@prisma/client";

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

// True only for a real calendar date written as YYYY-MM-DD (so 2026-02-30 is rejected).
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_FORMAT.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

// A day is 00:00:00 to 24:00:00 in Asia/Bangkok (UTC+07:00, no daylight saving). The end is exclusive (R-F13-1).
export function dayWindow(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00+07:00`);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

// Mean in whole seconds, 0.5 rounds up; null when there is nothing to average (R-F13-6).
export function averageSeconds(waits: number[]): number | null {
  if (waits.length === 0) return null;
  return Math.round(waits.reduce((sum, w) => sum + w, 0) / waits.length);
}

// Service summary of one queue and day, read from the status history (FR-20, F-13).
export async function queueSummary(prisma: PrismaClient, queueId: number, queueName: string, date: string) {
  const { start, end } = dayWindow(date);
  const inDay = { at: { gte: start, lt: end }, entry: { queueId } };
  const [served, cancelled, noShow, calledEvents] = await Promise.all([
    prisma.entryEvent.count({ where: { ...inDay, toStatus: "COMPLETED" } }),
    prisma.entryEvent.count({ where: { ...inDay, toStatus: "CANCELLED" } }),
    prisma.entryEvent.count({ where: { ...inDay, toStatus: "NO_SHOW" } }),
    prisma.entryEvent.findMany({
      where: { ...inDay, toStatus: "CALLED" },
      select: { at: true, entry: { select: { createdAt: true } } },
    }),
  ]);
  const waits = calledEvents.map((e) => (e.at.getTime() - e.entry.createdAt.getTime()) / 1000);
  return {
    queueId,
    queueName,
    date,
    served,
    cancelled,
    noShow,
    called: calledEvents.length,
    averageWaitSeconds: averageSeconds(waits),
  };
}
