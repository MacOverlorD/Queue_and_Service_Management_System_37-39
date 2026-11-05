import { describe, expect, test } from "vitest";
import { isSessionExpired } from "../../src/auth/session";

describe("TEST-F02-06b / AC-F02-06: expiry boundary", () => {
  test("expiresAt equal to now is expired; one second later is valid", () => {
    const now = new Date("2026-11-06T08:00:00.000Z");
    expect(isSessionExpired(new Date(now.getTime()), now)).toBe(true);
    expect(isSessionExpired(new Date(now.getTime() - 1), now)).toBe(true);
    expect(isSessionExpired(new Date(now.getTime() + 1000), now)).toBe(false);
  });
});
