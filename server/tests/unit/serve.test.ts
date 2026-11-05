import { describe, expect, test } from "vitest";
import { EntryStatus } from "@prisma/client";
import { nextStatus, pickNext } from "../../src/services/serve";

describe("TEST-F06-01 / AC-F06-01: head of the line", () => {
  test("pickNext returns the lowest number, or null for an empty line", () => {
    expect(pickNext([{ id: 1, number: 9 }, { id: 2, number: 4 }, { id: 3, number: 7 }])).toEqual({ id: 2, number: 4 });
    expect(pickNext([])).toBeNull();
  });
});

describe("TEST-F06-06 / AC-F06-06: transition table", () => {
  test("only CALLED -> SERVING (start) and SERVING -> COMPLETED (complete) are allowed", () => {
    const all: EntryStatus[] = ["WAITING", "CALLED", "SERVING", "COMPLETED", "CANCELLED", "NO_SHOW"];
    for (const s of all) {
      expect(nextStatus(s, "start")).toBe(s === "CALLED" ? "SERVING" : null);
      expect(nextStatus(s, "complete")).toBe(s === "SERVING" ? "COMPLETED" : null);
    }
  });
});
