import { prisma } from "@/config/prisma";

/**
 * Bed occupancy forecast + inventory reorder suggestions (spec §15, §18) +
 * revenue analytics/anomaly + lab turnaround + inventory anomaly (spec
 * §24-25, §22, §19).
 *
 * All of these are transparent rule-based heuristics (v1) — NOT trained
 * models. Real forecasting needs more accumulated history than a fresh
 * system has. Every function returns `isEstimate`/`method`/`disclaimer`
 * so the UI never presents these as certainties.
 */

export async function forecastBedOccupancy(hospitalId: string) {
  const beds = await prisma.bed.findMany({ where: { hospitalId } });
  const total = beds.length;
  const occupied = beds.filter((b) => b.status === "occupied").length;
  const available = beds.filter((b) => b.status === "available").length;
  const maintenance = beds.filter((b) => b.status === "maintenance").length;

  const occupancyRate = total === 0 ? 0 : occupied / total;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const fourWeeksAgo = new Date(today);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const recentEncounters = await prisma.encounter.findMany({
    where: { hospitalId, startedAt: { gte: fourWeeksAgo } },
    select: { startedAt: true },
  });
  const sameWeekdayCount = recentEncounters.filter((e) => e.startedAt.getDay() === dayOfWeek).length;
  const avgAdmissionsThisWeekday = Math.round((sameWeekdayCount / 4) * 10) / 10;

  const projectedOccupancyRate = Math.min(1, occupancyRate + avgAdmissionsThisWeekday / Math.max(total, 1));

  return {
    total,
    available,
    occupied,
    maintenance,
    occupancyRate: Math.round(occupancyRate * 100) / 100,
    projectedOccupancyRate: Math.round(projectedOccupancyRate * 100) / 100,
    avgAdmissionsThisWeekday,
    riskLevel: projectedOccupancyRate >= 0.9 ? "high" : projectedOccupancyRate >= 0.7 ? "medium" : "low",
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "This is a heuristic projection based on recent admission patterns, not a guarantee. Use it as one planning input among others.",
  };
}

export async function suggestReorders(hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({ where: { hospitalId } });

  const suggestions = items
    .filter((i) => i.currentStock <= i.reorderLevel)
    .map((i) => {
      const deficitRatio = i.reorderLevel === 0 ? 1 : (i.reorderLevel - i.currentStock) / i.reorderLevel;
      const urgency = i.currentStock === 0 ? "critical" : deficitRatio >= 0.5 ? "high" : "medium";
      const suggestedOrderQty = Math.max(i.reorderLevel * 2 - i.currentStock, i.reorderLevel);
      return {
        itemId: i.id,
        name: i.name,
        currentStock: i.currentStock,
        reorderLevel: i.reorderLevel,
        urgency,
        suggestedOrderQty,
      };
    })
    .sort((a, b) => (a.urgency === "critical" ? -1 : b.urgency === "critical" ? 1 : 0));

  return {
    suggestions,
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer: "Suggested quantities are a simple heuristic (2x reorder level), not based on consumption forecasting yet.",
  };
}

// --- Revenue analytics (spec §24) ---
export async function getRevenueAnalytics(hospitalId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [recentPayments, thisMonthAgg, lastMonthAgg] = await Promise.all([
    prisma.payment.findMany({
      where: { invoice: { hospitalId }, paidAt: { gte: sevenDaysAgo } },
      select: { amount: true, paidAt: true },
    }),
    prisma.payment.aggregate({
      where: { invoice: { hospitalId }, paidAt: { gte: thisMonthStart } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { invoice: { hospitalId }, paidAt: { gte: lastMonthStart, lt: thisMonthStart } },
      _sum: { amount: true },
    }),
  ]);

  // Group last 7 days of payments by calendar day for a simple trend line.
  const dailyTotals: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyTotals[d.toISOString().slice(0, 10)] = 0;
  }
  for (const p of recentPayments) {
    const key = p.paidAt.toISOString().slice(0, 10);
    if (key in dailyTotals) dailyTotals[key] += Number(p.amount);
  }

  const thisMonthRevenue = Number(thisMonthAgg._sum.amount ?? 0);
  const lastMonthRevenue = Number(lastMonthAgg._sum.amount ?? 0);
  const monthGrowthPct =
    lastMonthRevenue === 0 ? null : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10;

  return {
    dailyTrend: Object.entries(dailyTotals).map(([date, amount]) => ({ date, amount })),
    thisMonthRevenue,
    lastMonthRevenue,
    monthGrowthPct,
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer: "Simple period-over-period comparison — not adjusted for seasonality or patient volume changes.",
  };
}

export async function detectRevenueAnomaly(hospitalId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twoWeeksAgo = new Date(todayStart);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [todayPayments, historicalPayments] = await Promise.all([
    prisma.payment.aggregate({
      where: { invoice: { hospitalId }, paidAt: { gte: todayStart } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { invoice: { hospitalId }, paidAt: { gte: twoWeeksAgo, lt: todayStart } },
      select: { amount: true, paidAt: true },
    }),
  ]);

  const byDay: Record<string, number> = {};
  for (const p of historicalPayments) {
    const key = p.paidAt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + Number(p.amount);
  }
  const dailyValues = Object.values(byDay);
  const avgDailyRevenue = dailyValues.length === 0 ? 0 : dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length;
  const todayRevenue = Number(todayPayments._sum.amount ?? 0);

  // Simple threshold-based anomaly flag: today's revenue-so-far is
  // dramatically above the historical daily average. (A below-average flag
  // is deliberately NOT raised for partial-day totals — the day isn't over
  // yet, so "low so far" is expected and not anomalous on its own.)
  const isAnomaly = avgDailyRevenue > 0 && todayRevenue > avgDailyRevenue * 2.5;

  return {
    todayRevenue,
    avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
    isAnomaly,
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "Flags only unusually high revenue vs. the last 14 days' average — a starting point for review, not proof of an issue.",
  };
}

// --- Lab turnaround prediction (spec §22) ---
export async function forecastLabTurnaround(hospitalId: string) {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [resolvedRecently, backlog] = await Promise.all([
    prisma.labOrder.count({
      where: { hospitalId, status: "reviewed", createdAt: { gte: fourteenDaysAgo } },
    }),
    prisma.labOrder.count({ where: { hospitalId, status: { not: "reviewed" } } }),
  ]);

  const avgResolvedPerDay = Math.round((resolvedRecently / 14) * 10) / 10;
  const estimatedDaysToClearBacklog = avgResolvedPerDay === 0 ? null : Math.ceil(backlog / avgResolvedPerDay);

  return {
    currentBacklog: backlog,
    avgResolvedPerDay,
    estimatedDaysToClearBacklog,
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "Estimated from recent throughput, not per-order timestamps (the system doesn't track per-status timing yet). Treat as a rough planning signal only.",
  };
}

// --- Inventory anomaly detection (spec §19) ---
export async function detectInventoryAnomalies(hospitalId: string) {
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const baselineStart = new Date(now);
  baselineStart.setDate(baselineStart.getDate() - 17); // days -17 to -3 = a 14-day baseline window

  const [recentLogs, baselineLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: { hospitalId, action: "pharmacy.item.adjust_stock", createdAt: { gte: threeDaysAgo } },
      select: { resourceId: true, metadata: true },
    }),
    prisma.auditLog.findMany({
      where: { hospitalId, action: "pharmacy.item.adjust_stock", createdAt: { gte: baselineStart, lt: threeDaysAgo } },
      select: { resourceId: true, metadata: true },
    }),
  ]);

  function sumDispensed(logs: typeof recentLogs) {
    const totals: Record<string, number> = {};
    for (const log of logs) {
      if (!log.resourceId) continue;
      const delta = (log.metadata as { delta?: number } | null)?.delta ?? 0;
      if (delta < 0) totals[log.resourceId] = (totals[log.resourceId] ?? 0) + Math.abs(delta);
    }
    return totals;
  }

  const recentTotals = sumDispensed(recentLogs);
  const baselineTotals = sumDispensed(baselineLogs);

  const itemIds = Object.keys(recentTotals);
  const items = itemIds.length
    ? await prisma.inventoryItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, name: true } })
    : [];
  const nameById = Object.fromEntries(items.map((i) => [i.id, i.name]));

  const anomalies = itemIds
    .map((itemId) => {
      const recentRate = recentTotals[itemId] / 3;
      const baselineRate = (baselineTotals[itemId] ?? 0) / 14;
      const spikeRatio = baselineRate === 0 ? (recentRate > 0 ? Infinity : 0) : recentRate / baselineRate;
      return {
        itemId,
        name: nameById[itemId] ?? "Unknown item",
        recentDailyRate: Math.round(recentRate * 10) / 10,
        baselineDailyRate: Math.round(baselineRate * 10) / 10,
        spikeRatio: spikeRatio === Infinity ? null : Math.round(spikeRatio * 10) / 10,
      };
    })
    .filter((a) => (a.spikeRatio === null ? a.recentDailyRate > 0 : a.spikeRatio >= 2))
    .sort((a, b) => (b.spikeRatio ?? 999) - (a.spikeRatio ?? 999));

  return {
    anomalies,
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "Flags items dispensed at 2x+ their recent baseline rate — could be genuine demand, a data-entry error, or shrinkage. Worth a manual check, not a conclusion.",
  };
}