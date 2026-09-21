import { prisma } from "@/config/prisma";

interface CreateSubscriptionInput {
  organizationId: string;
  planName: string;
  seatLimit?: number;
  currentPeriodEnd?: Date;
}

export async function listSubscriptions() {
  return prisma.subscription.findMany({
    include: { organization: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSubscription(input: CreateSubscriptionInput) {
  return prisma.subscription.create({
    data: {
      organizationId: input.organizationId,
      planName: input.planName,
      seatLimit: input.seatLimit,
      currentPeriodEnd: input.currentPeriodEnd,
      status: "active",
    },
  });
}

const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "cancelled"];

export async function setSubscriptionStatus(subscriptionId: string, status: string) {
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    throw Object.assign(new Error("Invalid subscription status"), { statusCode: 400 });
  }
  return prisma.subscription.update({ where: { id: subscriptionId }, data: { status } });
}

// --- Usage-limit enforcement (spec Phase 6) ---
export async function getActiveSubscription(organizationId: string) {
  return prisma.subscription.findFirst({
    where: { organizationId, status: { in: ["active", "trialing"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function countOrgSeats(organizationId: string) {
  const rows = await prisma.userHospital.findMany({
    where: { hospital: { organizationId } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return rows.length;
}