import { prisma } from "@/config/prisma";

// Spec Phase 6 "Monitoring" — a lightweight operational snapshot for the
// platform super admin. Not a full observability stack (out of scope for
// an MVP), but enough to show the system is alive and how much load
// it's under.
export async function getPlatformSummary() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hospitalCount, activeUserCount, aiRequestsToday, activeSubscriptionCount] = await Promise.all([
    prisma.hospital.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.aIRequest.count({ where: { createdAt: { gte: since24h } } }),
    prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
  ]);

  return {
    processUptimeSeconds: Math.round(process.uptime()),
    activeHospitals: hospitalCount,
    activeUsers: activeUserCount,
    aiRequestsLast24h: aiRequestsToday,
    activeSubscriptions: activeSubscriptionCount,
    checkedAt: new Date().toISOString(),
  };
}