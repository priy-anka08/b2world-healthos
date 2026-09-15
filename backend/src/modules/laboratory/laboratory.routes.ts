import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { advanceOrderStatus, createLabOrder, createLabTest, listLabOrders, listLabTests } from "./laboratory.service";

export const laboratoryRouter = Router();
laboratoryRouter.use(authMiddleware, requireTenant);

laboratoryRouter.get("/tests", requirePermission("laboratory", "read"), async (req, res) => {
  res.json(await listLabTests(req.tenantHospitalId!));
});

const testSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  price: z.number().nonnegative(),
});

laboratoryRouter.post("/tests", requirePermission("laboratory", "create"), async (req, res, next) => {
  try {
    const body = testSchema.parse(req.body);
    const test = await createLabTest({ hospitalId: req.tenantHospitalId!, ...body });
    res.status(201).json(test);
  } catch (err) {
    next(err);
  }
});

laboratoryRouter.get("/orders", requirePermission("laboratory", "read"), async (req, res) => {
  res.json(await listLabOrders(req.tenantHospitalId!));
});

const orderSchema = z.object({
  patientId: z.string().uuid(),
  labTestId: z.string().uuid(),
});

laboratoryRouter.post("/orders", requirePermission("laboratory", "create"), async (req, res, next) => {
  try {
    const body = orderSchema.parse(req.body);
    const order = await createLabOrder({
      hospitalId: req.tenantHospitalId!,
      orderedByUserId: req.auth!.userId,
      ...body,
    });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "laboratory.order.create",
      resourceId: order.id,
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

laboratoryRouter.post("/orders/:id/advance", requirePermission("laboratory", "create"), async (req, res, next) => {
  try {
    const order = await advanceOrderStatus(req.tenantHospitalId!, req.params.id);
    res.json(order);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});