import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { getOperationalSummary } from "./reports.service";

export const reportsRouter = Router();
reportsRouter.use(authMiddleware, requireTenant);

reportsRouter.get("/summary", requirePermission("reports", "read"), async (req, res) => {
  res.json(await getOperationalSummary(req.tenantHospitalId!));
});