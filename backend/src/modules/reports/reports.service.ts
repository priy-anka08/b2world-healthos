import { prisma } from "@/config/prisma";

// Cross-module operational summary (spec's "Reports" module). Deliberately
// read-only aggregation over existing tables — no new data model needed.
export async function getOperationalSummary(hospitalId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    totalPatients,
    newPatientsThisMonth,
    appointmentsThisMonth,
    completedAppointmentsThisMonth,
    noShowsThisMonth,
    revenueThisMonth,
    unpaidInvoiceCount,
    activeStaffCount,
    bedStats,
    lowStockCount,
    pendingLabOrders,
  ] = await Promise.all([
    prisma.patient.count({ where: { hospitalId } }),
    prisma.patient.count({ where: { hospitalId, createdAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.appointment.count({
      where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd }, status: "COMPLETED" },
    }),
    prisma.appointment.count({
      where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd }, status: "NO_SHOW" },
    }),
    prisma.payment.aggregate({
      where: { invoice: { hospitalId }, paidAt: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.invoice.count({ where: { hospitalId, status: { not: "paid" } } }),
    prisma.staff.count({ where: { hospitalId, user: { status: "ACTIVE" } } }),
    prisma.bed.findMany({ where: { hospitalId }, select: { status: true } }),
    prisma.inventoryItem
      .findMany({ where: { hospitalId }, select: { currentStock: true, reorderLevel: true } })
      .then((items) => items.filter((i) => i.currentStock <= i.reorderLevel).length),
    prisma.labOrder.count({ where: { hospitalId, status: { not: "reviewed" } } }),
  ]);

  const totalBeds = bedStats.length;
  const occupiedBeds = bedStats.filter((b) => b.status === "occupied").length;

  return {
    period: { start: monthStart.toISOString(), end: monthEnd.toISOString() },
    patients: { total: totalPatients, newThisMonth: newPatientsThisMonth },
    appointments: {
      thisMonth: appointmentsThisMonth,
      completed: completedAppointmentsThisMonth,
      noShows: noShowsThisMonth,
      noShowRate: appointmentsThisMonth === 0 ? 0 : Math.round((noShowsThisMonth / appointmentsThisMonth) * 100) / 100,
    },
    finance: {
      revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
      unpaidInvoiceCount,
    },
    staff: { activeCount: activeStaffCount },
    beds: {
      total: totalBeds,
      occupied: occupiedBeds,
      occupancyRate: totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100) / 100,
    },
    pharmacy: { lowStockItemCount: lowStockCount },
    laboratory: { pendingOrders: pendingLabOrders },
  };
}