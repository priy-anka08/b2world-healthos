import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { adjustStock, createInventoryItem, listInventory } from "./pharmacy.service";

export const pharmacyRouter = Router();
pharmacyRouter.use(authMiddleware, requireTenant);

pharmacyRouter.get("/", requirePermission("pharmacy", "read"), async (req, res) => {
  res.json(await listInventory(req.tenantHospitalId!));
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  reorderLevel: z.number().int().min(0).optional(),
  currentStock: z.number().int().min(0).optional(),
});

pharmacyRouter.post("/", requirePermission("pharmacy", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const item = await createInventoryItem({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "pharmacy.item.create",
      resourceId: item.id,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({ delta: z.number().int() });

pharmacyRouter.post("/:id/adjust-stock", requirePermission("pharmacy", "create"), async (req, res, next) => {
  try {
    const { delta } = adjustSchema.parse(req.body);
    const item = await adjustStock(req.tenantHospitalId!, req.params.id, delta);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "pharmacy.item.adjust_stock",
      resourceId: item.id,
      metadata: { delta },
    });
    res.json(item);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});