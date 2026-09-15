import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createStaff, listStaff } from "./staff.service";

export const staffRouter = Router();
staffRouter.use(authMiddleware, requireTenant);

staffRouter.get("/", requirePermission("staff", "read"), async (req, res) => {
  res.json(await listStaff(req.tenantHospitalId!));
});

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  temporaryPassword: z.string().min(8),
  jobTitle: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  role: z.enum(["NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT"]),
});

staffRouter.post("/", requirePermission("staff", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const staff = await createStaff({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "staff.create",
      resourceId: staff.id,
      metadata: { role: body.role },
    });
    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});