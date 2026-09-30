import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({
  prisma: {
    department: { findFirst: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/config/prisma";
import { forecastEmergencyVolume } from "./ai-predictions.service";

describe("forecastEmergencyVolume", () => {
  beforeEach(() => vi.clearAllMocks());

  it("picks the busiest 4-hour rolling window from appointment timestamps", async () => {
    (prisma.department.findFirst as any).mockResolvedValue({ id: "dept-1", name: "Emergency" });

    // 5 appointments clustered around 6-9 PM, 1 stray at 9 AM
    const times = [18, 18, 19, 19, 20, 9].map((h) => {
      const d = new Date();
      d.setHours(h, 0, 0, 0);
      return { scheduledAt: d };
    });
    (prisma.appointment.findMany as any).mockResolvedValue(times);

    const result = await forecastEmergencyVolume("hosp-1");

    expect(result.scopedToDepartment).toBe("Emergency");
    expect(result.sampleSizeAppointments).toBe(6);
    expect(result.isEstimate).toBe(true);
    // busiest window should start at or before 6PM and include the 6-9PM cluster
    expect(result.busiestWindow).toMatch(/PM/);
  });

  it("falls back to all appointments when no Emergency department exists", async () => {
    (prisma.department.findFirst as any).mockResolvedValue(null);
    (prisma.appointment.findMany as any).mockResolvedValue([]);

    const result = await forecastEmergencyVolume("hosp-1");

    expect(result.scopedToDepartment).toContain("no department named");
    expect(result.sampleSizeAppointments).toBe(0);
  });
});