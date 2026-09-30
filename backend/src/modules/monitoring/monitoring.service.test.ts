import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({
  prisma: {
    hospital: { count: vi.fn() },
    user: { count: vi.fn() },
    aIRequest: { count: vi.fn() },
    subscription: { count: vi.fn() },
  },
}));

import { prisma } from "@/config/prisma";
import { getPlatformSummary } from "./monitoring.service";

describe("getPlatformSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aggregates platform counts into one snapshot", async () => {
    (prisma.hospital.count as any).mockResolvedValue(3);
    (prisma.user.count as any).mockResolvedValue(42);
    (prisma.aIRequest.count as any).mockResolvedValue(17);
    (prisma.subscription.count as any).mockResolvedValue(2);

    const result = await getPlatformSummary();

    expect(result.activeHospitals).toBe(3);
    expect(result.activeUsers).toBe(42);
    expect(result.aiRequestsLast24h).toBe(17);
    expect(result.activeSubscriptions).toBe(2);
    expect(typeof result.processUptimeSeconds).toBe("number");
    expect(result.checkedAt).toBeDefined();
  });

  it("scopes the AI-request count to the last 24 hours", async () => {
    (prisma.hospital.count as any).mockResolvedValue(1);
    (prisma.user.count as any).mockResolvedValue(1);
    (prisma.aIRequest.count as any).mockResolvedValue(0);
    (prisma.subscription.count as any).mockResolvedValue(0);

    await getPlatformSummary();

    const callArg = (prisma.aIRequest.count as any).mock.calls[0][0];
    const cutoff = callArg.where.createdAt.gte as Date;
    const hoursAgo = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60);
    expect(hoursAgo).toBeCloseTo(24, 0);
  });
});