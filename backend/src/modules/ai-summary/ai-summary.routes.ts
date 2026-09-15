import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { summarizePatientHistory } from "./ai-summary.service";

export const aiSummaryRouter = Router();
aiSummaryRouter.use(authMiddleware, requireTenant);

aiSummaryRouter.get("/patient/:patientId", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    const result = await summarizePatientHistory(req.tenantHospitalId!, req.auth!.userId, req.params.patientId);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});