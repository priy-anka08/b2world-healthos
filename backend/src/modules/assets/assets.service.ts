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

  const record = await prisma.maintenanceRecord.create({
    data: { assetId, type, notes },
  });

  // Logging a maintenance event returns the asset to operational status —
  // a reasonable default; real workflows might keep it in "maintenance"
  // until an explicit "return to service" action.
  await prisma.asset.update({ where: { id: assetId }, data: { status: "operational" } });

  return record;
}