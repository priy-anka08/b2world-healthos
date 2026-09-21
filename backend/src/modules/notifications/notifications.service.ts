import { prisma } from "@/config/prisma";

interface CreateNotificationInput {
  hospitalId: string;
  userId?: string;
  channel: string;
  title: string;
  body: string;
}

export async function listNotifications(hospitalId: string, userId: string) {
  return prisma.notification.findMany({
    where: { hospitalId, OR: [{ userId }, { userId: null }] },
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
  return prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
}

// Spec §7 (appointment reminders) + §18/§19 (low stock & expiry alerts),
// swept together in one pass. No cron infra in this MVP, so it's manually
// triggered via POST /notifications/run-checks (an admin action for now —
// wire to an external scheduler in production, spec §41 Phase 6).
export async function runDailyChecks(hospitalId: string) {
  const created: string[] = [];

  const items = await prisma.inventoryItem.findMany({ where: { hospitalId } });
  for (const item of items.filter((i) => i.currentStock <= i.reorderLevel)) {
    await createNotification({
      hospitalId,
      channel: "in_app",
      title: "Low stock alert",
      body: `${item.name} is at ${item.currentStock} ${item.unit} (reorder level: ${item.reorderLevel}).`,
    });
    created.push(`low_stock:${item.id}`);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 7);
  const expiring = await prisma.inventoryBatch.findMany({
    where: { expiryDate: { lte: cutoff }, item: { hospitalId } },
    include: { item: { select: { name: true } } },
  });
  for (const batch of expiring) {
    await createNotification({
      hospitalId,
      channel: "in_app",
      title: "Batch expiring soon",
      body: `${batch.item.name} batch ${batch.batchNumber} expires ${batch.expiryDate.toDateString()}.`,
    });
    created.push(`expiring_batch:${batch.id}`);
  }

  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const tomorrowAppointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      scheduledAt: { gte: tomorrowStart, lte: tomorrowEnd },
      status: { in: ["REQUESTED", "CONFIRMED"] },
      reminderSentAt: null,
    },
    include: { patient: { select: { userId: true } } },
  });
  for (const appt of tomorrowAppointments) {
    if (appt.patient.userId) {
      await createNotification({
        hospitalId,
        userId: appt.patient.userId,
        channel: "in_app",
        title: "Appointment reminder",
        body: `You have an appointment tomorrow at ${appt.scheduledAt.toLocaleTimeString()}.`,
      });
    }
    await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } });
    created.push(`appointment_reminder:${appt.id}`);
  }

  return { notificationsCreated: created.length, breakdown: created };
}