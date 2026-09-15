import { prisma } from "@/config/prisma";

interface CreateNotificationInput {
  hospitalId: string;
  userId?: string;
  channel: string; // "in_app" | "email" | "sms" — only in_app is actually delivered by this MVP
  title: string;
  body: string;
}

export async function listNotifications(hospitalId: string, userId: string) {
  return prisma.notification.findMany({
    where: {
      hospitalId,
      // A notification with no userId is treated as hospital-wide (visible
      // to everyone); one with a userId is only shown to that user.
      OR: [{ userId }, { userId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      hospitalId: input.hospitalId,
      userId: input.userId,
      channel: input.channel,
      title: input.title,
      body: input.body,
    },
  });
}

export async function markRead(hospitalId: string, notificationId: string) {
  const notif = await prisma.notification.findFirst({ where: { id: notificationId, hospitalId } });
  if (!notif) throw Object.assign(new Error("Notification not found"), { statusCode: 404 });

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}