import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createPractitioner, listPractitioners } from "./practitioners.service";

export const practitionersRouter = Router();
practitionersRouter.use(authMiddleware, requireTenant);

practitionersRouter.get("/", requirePermission("practitioners", "read"), async (req, res) => {
  res.json(await listPractitioners(req.tenantHospitalId!));
});

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  temporaryPassword: z.string().min(8),
  specialization: z.string().optional(),
  licenseNumber: z.string().optional(),
});

practitionersRouter.post("/", requirePermission("practitioners", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const practitioner = await createPractitioner({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "practitioner.create",
      resourceId: practitioner.id,
    });
    res.status(201).json(practitioner);
  } catch (err) {
    next(err);
  }
});