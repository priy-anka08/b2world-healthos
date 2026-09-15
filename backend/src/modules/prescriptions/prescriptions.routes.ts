import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createPrescription, listPrescriptions } from "./prescriptions.service";

export const prescriptionsRouter = Router();
prescriptionsRouter.use(authMiddleware, requireTenant);

prescriptionsRouter.get("/", requirePermission("prescriptions", "read"), async (req, res, next) => {
  try {
    const encounterId = z.string().uuid().parse(req.query.encounterId);
    res.json(await listPrescriptions(req.tenantHospitalId!, encounterId));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

const createSchema = z.object({
  encounterId: z.string().uuid(),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

prescriptionsRouter.post("/", requirePermission("prescriptions", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const prescription = await createPrescription(req.tenantHospitalId!, body);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "prescription.create",
      resourceId: prescription.id,
    });
    res.status(201).json(prescription);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});