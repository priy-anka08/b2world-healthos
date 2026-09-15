import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { closeEncounter, getEncounter, startEncounter } from "./encounters.service";

export const encountersRouter = Router();
encountersRouter.use(authMiddleware, requireTenant);

const startSchema = z.object({ appointmentId: z.string().uuid() });

encountersRouter.post("/start", requirePermission("clinical_notes", "create"), async (req, res, next) => {
  try {
    const { appointmentId } = startSchema.parse(req.body);
    const encounter = await startEncounter(req.tenantHospitalId!, appointmentId);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "encounter.start",
      resourceId: encounter.id,
    });
    res.status(201).json(encounter);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

encountersRouter.get("/:id", requirePermission("clinical_notes", "read"), async (req, res) => {
  const encounter = await getEncounter(req.tenantHospitalId!, req.params.id);
  if (!encounter) return res.status(404).json({ error: "Not found" });
  res.json(encounter);
});

encountersRouter.post("/:id/close", requirePermission("clinical_notes", "create"), async (req, res, next) => {
  try {
    const encounter = await closeEncounter(req.tenantHospitalId!, req.params.id);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "encounter.close",
      resourceId: encounter.id,
    });
    res.json(encounter);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});