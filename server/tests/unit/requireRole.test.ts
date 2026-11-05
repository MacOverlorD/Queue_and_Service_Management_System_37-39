import { describe, expect, test, vi } from "vitest";
import type { Request, Response } from "express";
import { requireRole } from "../../src/middleware/requireRole";

function run(user: { id: number; name: string; role: "CUSTOMER" | "OPERATOR" } | undefined, role: "CUSTOMER" | "OPERATOR") {
  const req = { user } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
  const next = vi.fn();
  requireRole(role)(req, res, next);
  return { res, json, next };
}

describe("requireRole (unit, supports AC-F03-02 / AC-F03-04)", () => {
  test("lets a matching role through", () => {
    const { next, res } = run({ id: 1, name: "Op", role: "OPERATOR" }, "OPERATOR");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("rejects a different role with 403 FORBIDDEN_ROLE and the shared error shape", () => {
    const { next, res, json } = run({ id: 2, name: "Cu", role: "CUSTOMER" }, "OPERATOR");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0][0];
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error.code).toBe("FORBIDDEN_ROLE");
    expect(Object.keys(body.error).sort()).toEqual(["code", "message"]);
  });

  test("treats a missing user as 401 UNAUTHENTICATED (defensive, requireAuth should run first)", () => {
    const { next, res, json } = run(undefined, "CUSTOMER");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(json.mock.calls[0][0].error.code).toBe("UNAUTHENTICATED");
  });
});
