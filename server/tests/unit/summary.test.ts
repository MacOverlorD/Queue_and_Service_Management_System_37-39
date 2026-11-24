import { describe, expect, test } from "vitest";
import { averageSeconds, dayWindow } from "../../src/services/summary";

describe("TEST-F13-08 / AC-F13-02, AC-F13-03: day window and average", () => {
  test("dayWindow is the Bangkok day, upper bound exclusive", () => {
    const { start, end } = dayWindow("2026-11-20");
    expect(start.toISOString()).toBe("2026-11-19T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-20T17:00:00.000Z");
  });

  test("averageSeconds is the mean in whole seconds, 0.5 rounds up, empty is null", () => {
    expect(averageSeconds([120, 300])).toBe(210);
    expect(averageSeconds([1, 2])).toBe(2);
    expect(averageSeconds([])).toBeNull();
  });
});
