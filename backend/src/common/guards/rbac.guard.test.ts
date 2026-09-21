import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({ prisma: { rolePermission: { findFirst: vi.fn() } } }));

import { prisma } from "@/config/prisma";
import { requirePermission } from "./rbac.guard";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("requirePermission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests with 401", async () => {
    const res = mockRes();
    const next = vi.fn();
    await requirePermission("patients", "read")({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("bypasses the check for super admins without hitting the DB", async () => {
    const req: any = { auth: { userId: "u1", isSuperAdmin: true } };
    const res = mockRes();
    const next = vi.fn();
    await requirePermission("patients", "read")(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a session with no role", async () => {
    const req: any = { auth: { userId: "u1", isSuperAdmin: false, role: null } };
    const res = mockRes();
    const next = vi.fn();
    await requirePermission("patients", "read")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows the request when a matching RolePermission exists", async () => {
    (prisma.rolePermission.findFirst as any).mockResolvedValue({ id: "rp1" });
    const req: any = { auth: { userId: "u1", isSuperAdmin: false, role: "RECEPTIONIST" } };
    const res = mockRes();
    const next = vi.fn();
    await requirePermission("patients", "create")(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("denies with 403 when no matching permission exists", async () => {
    (prisma.rolePermission.findFirst as any).mockResolvedValue(null);
    const req: any = { auth: { userId: "u1", isSuperAdmin: false, role: "RECEPTIONIST" } };
    const res = mockRes();
    const next = vi.fn();
    await requirePermission("billing", "create")(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});