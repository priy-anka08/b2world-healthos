import { prisma } from "@/config/prisma";

interface CreateAssetInput {
  hospitalId: string;
  name: string;
  category: string;
  location?: string;
  purchaseDate?: Date;
  warrantyUntil?: Date;
}

export async function listAssets(hospitalId: string) {
  return prisma.asset.findMany({
    where: { hospitalId },
    include: { maintenanceRecords: { orderBy: { performedAt: "desc" }, take: 5 } },
    orderBy: { name: "asc" },
  });
}

export async function createAsset(input: CreateAssetInput) {
  return prisma.asset.create({
    data: {
      hospitalId: input.hospitalId,
      name: input.name,
      category: input.category,
      location: input.location,
      purchaseDate: input.purchaseDate,
      warrantyUntil: input.warrantyUntil,
      status: "operational",
    },
  });
}

const ASSET_STATUSES = ["operational", "maintenance", "decommissioned"];

export async function setAssetStatus(hospitalId: string, assetId: string, status: string) {
  if (!ASSET_STATUSES.includes(status)) {
    throw Object.assign(new Error("Invalid asset status"), { statusCode: 400 });
  }
  const asset = await prisma.asset.findFirst({ where: { id: assetId, hospitalId } });
  if (!asset) throw Object.assign(new Error("Asset not found"), { statusCode: 404 });

  return prisma.asset.update({ where: { id: assetId }, data: { status } });
}

export async function logMaintenance(hospitalId: string, assetId: string, type: string, notes?: string) {
  const asset = await prisma.asset.findFirst({ where: { id: assetId, hospitalId } });
  if (!asset) throw Object.assign(new Error("Asset not found"), { statusCode: 404 });

  const record = await prisma.maintenanceRecord.create({ data: { assetId, type, notes } });
  await prisma.asset.update({ where: { id: assetId }, data: { status: "operational" } });
  return record;
}

// --- Predictive equipment maintenance (spec §29) ---
export async function calculateMaintenanceRisk(hospitalId: string, assetId: string) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, hospitalId },
    include: { maintenanceRecords: { orderBy: { performedAt: "desc" } } },
  });
  if (!asset) throw Object.assign(new Error("Asset not found"), { statusCode: 404 });

  const lastServiced = asset.maintenanceRecords[0]?.performedAt ?? asset.purchaseDate;
  const daysSinceService = lastServiced ? Math.floor((Date.now() - lastServiced.getTime()) / 86400000) : null;

  // Risk grows toward 1.0 over a year without any servicing; recent
  // repairs (not scheduled checks) push it up further — they signal the
  // equipment is already misbehaving, not just due for a checkup.
  const ageRisk = daysSinceService === null ? 0.3 : Math.min(0.9, daysSinceService / 365);
  const recentRepairs = asset.maintenanceRecords.filter(
    (r) => r.type === "repair" && Date.now() - r.performedAt.getTime() < 180 * 86400000
  ).length;
  const repairRisk = Math.min(0.3, recentRepairs * 0.1);

  const riskScore = Math.round(Math.min(0.95, ageRisk + repairRisk) * 100) / 100;

  await prisma.asset.update({ where: { id: assetId }, data: { maintenanceRiskScore: riskScore } });

  return {
    assetId,
    assetName: asset.name,
    maintenanceRiskScore: riskScore,
    daysSinceLastService: daysSinceService,
    recentRepairCount: recentRepairs,
    riskLevel: riskScore >= 0.7 ? "high" : riskScore >= 0.4 ? "medium" : "low",
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "A maintenance-prioritization signal from time-since-service and recent repair frequency — not a guaranteed failure prediction (spec §29).",
  };
}

export async function scoreAllAssetMaintenanceRisk(hospitalId: string) {
  const assets = await prisma.asset.findMany({
    where: { hospitalId, status: { not: "decommissioned" } },
    select: { id: true },
  });
  const results = [];
  for (const a of assets) results.push(await calculateMaintenanceRisk(hospitalId, a.id));
  return results.sort((a, b) => b.maintenanceRiskScore - a.maintenanceRiskScore);
}