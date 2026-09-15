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