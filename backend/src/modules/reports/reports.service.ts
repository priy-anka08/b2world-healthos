import { prisma } from "@/config/prisma";
import { forecastLabTurnaround } from "@/modules/ai-predictions/ai-predictions.service";

export async function getOperationalSummary(hospitalId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const [
    totalPatients, newPatientsThisMonth, appointmentsThisMonth, completedAppointmentsThisMonth,
    noShowsThisMonth, revenueThisMonth, unpaidInvoiceCount, activeStaffCount, bedStats,
    lowStockCount, pendingLabOrders, emergencyDept,
  ] = await Promise.all([
    prisma.patient.count({ where: { hospitalId } }),
    prisma.patient.count({ where: { hospitalId, createdAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd } } }),
    prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd }, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: monthStart, lt: monthEnd }, status: "NO_SHOW" } }),
    prisma.payment.aggregate({ where: { invoice: { hospitalId }, paidAt: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { hospitalId, status: { not: "paid" } } }),
    prisma.staff.count({ where: { hospitalId, user: { status: "ACTIVE" } } }),
    prisma.bed.findMany({ where: { hospitalId }, select: { status: true } }),
    prisma.inventoryItem.findMany({ where: { hospitalId }, select: { currentStock: true, reorderLevel: true } }).then((items) => items.filter((i) => i.currentStock <= i.reorderLevel).length),
    prisma.labOrder.count({ where: { hospitalId, status: { not: "reviewed" } } }),
    prisma.department.findFirst({ where: { hospitalId, name: { contains: "emergency", mode: "insensitive" } } }),
  ]);

  const [emergencyCasesToday, deptPerf, completedTodayDurations, pharmacyLogs, labTurnaround, dailyPatientCounts] = await Promise.all([
    emergencyDept
      ? prisma.appointment.count({ where: { hospitalId, departmentId: emergencyDept.id, scheduledAt: { gte: todayStart, lte: todayEnd } } })
      : 0,
    prisma.department.findMany({
      where: { hospitalId },
      select: { name: true, _count: { select: { appointments: { where: { scheduledAt: { gte: monthStart, lt: monthEnd } } } } } },
    }),
    prisma.appointment.findMany({ where: { hospitalId, status: "COMPLETED", scheduledAt: { gte: todayStart, lte: todayEnd } }, select: { durationMins: true } }),
    prisma.auditLog.findMany({ where: { hospitalId, action: "pharmacy.item.adjust_stock", createdAt: { gte: monthStart, lt: monthEnd } }, select: { metadata: true } }),
    forecastLabTurnaround(hospitalId),
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = new Date(now); day.setDate(day.getDate() - (6 - i)); day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
        return prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: day, lt: nextDay } } }).then((count) => ({ date: day.toISOString().slice(0, 10), count }));
      })
    ),
  ]);

  const totalBeds = bedStats.length;
  const occupiedBeds = bedStats.filter((b) => b.status === "occupied").length;
  const avgWaitingTimeMinutes = completedTodayDurations.length
    ? Math.round(completedTodayDurations.reduce((s, a) => s + a.durationMins, 0) / completedTodayDurations.length)
    : null;
  const pharmacyConsumptionThisMonth = pharmacyLogs.reduce((s, l) => {
    const d = (l.metadata as { delta?: number } | null)?.delta ?? 0;
    return d < 0 ? s + Math.abs(d) : s;
  }, 0);

  return {
    period: { start: monthStart.toISOString(), end: monthEnd.toISOString() },
    patients: { total: totalPatients, newThisMonth: newPatientsThisMonth },
    appointments: {
      thisMonth: appointmentsThisMonth,
      completed: completedAppointmentsThisMonth,
      noShows: noShowsThisMonth,
      noShowRate: appointmentsThisMonth === 0 ? 0 : Math.round((noShowsThisMonth / appointmentsThisMonth) * 100) / 100,
    },
    finance: { revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0), unpaidInvoiceCount },
    staff: { activeCount: activeStaffCount },
    beds: { total: totalBeds, occupied: occupiedBeds, occupancyRate: totalBeds === 0 ? 0 : Math.round((occupiedBeds / totalBeds) * 100) / 100 },
    pharmacy: { lowStockItemCount: lowStockCount, consumptionThisMonth: pharmacyConsumptionThisMonth },
    laboratory: { pendingOrders: pendingLabOrders, avgTurnaroundDaysToClearBacklog: labTurnaround.estimatedDaysToClearBacklog },
    emergency: { casesToday: emergencyCasesToday, hasDedicatedDepartment: !!emergencyDept },
    departmentPerformance: deptPerf.map((d) => ({ name: d.name, appointmentsThisMonth: d._count.appointments })).sort((a, b) => b.appointmentsThisMonth - a.appointmentsThisMonth).slice(0, 5),
    avgWaitingTimeMinutesToday: avgWaitingTimeMinutes,
    patientVolumeTrend: dailyPatientCounts,
  };
}