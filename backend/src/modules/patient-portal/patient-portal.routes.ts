import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { getMyPortalData, invitePortalAccess } from "./patient-portal.service";

export const patientPortalRouter = Router();

patientPortalRouter.post(
  "/invite/:patientId",
  authMiddleware,
  requireTenant,
  requirePermission("patients", "create"),
  async (req, res, next) => {
    try {
      const { email, temporaryPassword } = z
        .object({ email: z.string().email(), temporaryPassword: z.string().min(8) })
        .parse(req.body);
      const result = await invitePortalAccess({
        hospitalId: req.tenantHospitalId!,
        patientId: req.params.patientId,
        email,
        temporaryPassword,
      });
      await writeAuditLog({
        hospitalId: req.tenantHospitalId,
        userId: req.auth!.userId,
        action: "patient_portal.invite",
        resourceId: result.userId,
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
      }
      next(err);
    }
  }
);

patientPortalRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const data = await getMyPortalData(req.auth!.userId);
    res.json(data);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});