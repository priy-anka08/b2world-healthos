import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createAsset, listAssets, logMaintenance, setAssetStatus } from "./assets.service";

export const assetsRouter = Router();
assetsRouter.use(authMiddleware, requireTenant);

assetsRouter.get("/", requirePermission("assets", "read"), async (req, res) => {
  res.json(await listAssets(req.tenantHospitalId!));
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  location: z.string().optional(),
  purchaseDate: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
});

assetsRouter.post("/", requirePermission("assets", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const asset = await createAsset({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "assets.asset.create",
      resourceId: asset.id,
    });
    res.status(201).json(asset);
  } catch (err) {
    next(err);
  }
});

assetsRouter.post("/:id/status", requirePermission("assets", "create"), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const asset = await setAssetStatus(req.tenantHospitalId!, req.params.id, status);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "assets.asset.status_change",
      resourceId: asset.id,
      metadata: { status },
    });
    res.json(asset);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

const maintenanceSchema = z.object({
  type: z.enum(["scheduled", "repair", "inspection"]),
  notes: z.string().optional(),
});

assetsRouter.post("/:id/maintenance", requirePermission("assets", "create"), async (req, res, next) => {
  try {
    const body = maintenanceSchema.parse(req.body);
    const record = await logMaintenance(req.tenantHospitalId!, req.params.id, body.type, body.notes);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "assets.maintenance.log",
      resourceId: record.id,
      metadata: { type: body.type },
    });
    res.status(201).json(record);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});