import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({
  prisma: {
    shift: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    staff: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/config/prisma";
import { createShift, markShiftStatus } from "./staff.service";

describe("staff attendance & leave", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createShift throws 404 when staff isn't in this hospital", async () => {
    (prisma.staff.findFirst as any).mockResolvedValue(null);
    await expect(createShift("hosp-1", "staff-1", new Date(), new Date())).rejects.toMatchObject({ statusCode: 404 });
  });

  it("createShift defaults to 'scheduled' status", async () => {
    (prisma.staff.findFirst as any).mockResolvedValue({ id: "staff-1" });
    (prisma.shift.create as any).mockResolvedValue({ id: "shift-1", status: "scheduled" });
    await createShift("hosp-1", "staff-1", new Date(), new Date());
    expect(prisma.shift.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "scheduled" }) }));
  });

  it("markShiftStatus throws 404 when the shift isn't in this hospital", async () => {
    (prisma.shift.findFirst as any).mockResolvedValue(null);
    await expect(markShiftStatus("hosp-1", "shift-1", "absent")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("markShiftStatus updates the status when found", async () => {
    (prisma.shift.findFirst as any).mockResolvedValue({ id: "shift-1" });
    (prisma.shift.update as any).mockResolvedValue({ id: "shift-1", status: "absent" });
    const result = await markShiftStatus("hosp-1", "shift-1", "absent");
    expect(result.status).toBe("absent");
  });
});