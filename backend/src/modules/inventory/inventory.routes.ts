import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import {
  listInventory,
  createInventoryItem,
  adjustStock,
  lowStockItems,
  addBatch,
  listBatches,
  expiringBatches,
} from "./inventory.service";

export const inventoryRouter = Router();
inventoryRouter.use(authMiddleware, requireTenant);

inventoryRouter.get("/", requirePermission("inventory", "read"), async (req, res, next) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    res.json(await listInventory(req.tenantHospitalId!, category));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/low-stock", requirePermission("inventory", "read"), async (req, res, next) => {
  try {
    res.json(await lowStockItems(req.tenantHospitalId!));
  } catch (err) {
    next(err);
  }
});

inventoryRouter.get("/expiring", requirePermission("inventory", "read"), async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    res.json(await expiringBatches(req.tenantHospitalId!, days));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["medicine", "consumable", "equipment_part"]),
  unit: z.string().min(1),
  reorderLevel: z.number().int().min(0).optional(),
  currentStock: z.number().int().min(0).optional(),
});

inventoryRouter.post("/", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const item = await createInventoryItem({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "inventory.create",
      resourceId: item.id,
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

const adjustSchema = z.object({ delta: z.number().int() });

inventoryRouter.post("/:id/adjust-stock", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const { delta } = adjustSchema.parse(req.body);
    const item = await adjustStock(req.tenantHospitalId!, req.params.id, delta);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "inventory.adjust_stock",
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

inventoryRouter.get("/:id/batches", requirePermission("inventory", "read"), async (req, res, next) => {
  try {
    res.json(await listBatches(req.tenantHospitalId!, req.params.id));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

const batchSchema = z.object({
  batchNumber: z.string().min(1),
  quantity: z.number().int().positive(),
  expiryDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid date"),
  supplierId: z.string().uuid().optional(),
});

inventoryRouter.post("/:id/batches", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const body = batchSchema.parse(req.body);
    const batch = await addBatch({
      hospitalId: req.tenantHospitalId!,
      itemId: req.params.id,
      batchNumber: body.batchNumber,
      quantity: body.quantity,
      expiryDate: new Date(body.expiryDate),
      supplierId: body.supplierId,
    });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "inventory.batch_add",
      resourceId: batch.id,
      metadata: { itemId: req.params.id, quantity: body.quantity },
    });
    res.status(201).json(batch);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});