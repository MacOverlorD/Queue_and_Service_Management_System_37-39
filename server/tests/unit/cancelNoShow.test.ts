import { describe, expect, test } from "vitest";
import { EntryStatus } from "@prisma/client";
import { nextStatus } from "../../src/services/serve";

const ALL: EntryStatus[] = ["WAITING", "CALLED", "SERVING", "COMPLETED", "CANCELLED", "NO_SHOW"];

describe("TEST-F09-01 / AC-F09-02, AC-F09-06: Sprint 2 transition table", () => {
  test("only WAITING -> CANCELLED (cancel) and CALLED -> NO_SHOW (noShow) are allowed", () => {
    for (const s of ALL) {
      expect(nextStatus(s, "cancel")).toBe(s === "WAITING" ? "CANCELLED" : null);
      expect(nextStatus(s, "noShow")).toBe(s === "CALLED" ? "NO_SHOW" : null);
    }
  });

  test("the F-06 transitions are unchanged", () => {
    for (const s of ALL) {
      expect(nextStatus(s, "start")).toBe(s === "CALLED" ? "SERVING" : null);
      expect(nextStatus(s, "complete")).toBe(s === "SERVING" ? "COMPLETED" : null);
    }
  });
});
