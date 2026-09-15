import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import {
  createPurchaseOrder,
  createSupplier,
  listPurchaseOrders,
  listSuppliers,
  setPurchaseOrderStatus,
} from "./suppliers.service";

export const suppliersRouter = Router();
suppliersRouter.use(authMiddleware, requireTenant);

suppliersRouter.get("/", requirePermission("inventory", "read"), async (req, res) => {
  res.json(await listSuppliers(req.tenantHospitalId!));
});

const supplierSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  email: z.string().email().optional(),
});

suppliersRouter.post("/", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const body = supplierSchema.parse(req.body);
    const supplier = await createSupplier({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "supplier.create",
      resourceId: supplier.id,
    });
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.get("/purchase-orders", requirePermission("inventory", "read"), async (req, res) => {
  res.json(await listPurchaseOrders(req.tenantHospitalId!));
});

const poSchema = z.object({
  supplierId: z.string().uuid(),
  totalAmount: z.number().positive(),
});

suppliersRouter.post("/purchase-orders", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const body = poSchema.parse(req.body);
    const po = await createPurchaseOrder({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "purchase_order.create",
      resourceId: po.id,
    });
    res.status(201).json(po);
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post("/purchase-orders/:id/status", requirePermission("inventory", "create"), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const po = await setPurchaseOrderStatus(req.tenantHospitalId!, req.params.id, status);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "purchase_order.status_change",
      resourceId: po.id,
      metadata: { status },
    });
    res.json(po);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});