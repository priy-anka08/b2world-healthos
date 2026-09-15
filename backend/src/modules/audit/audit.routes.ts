import { Router } from "express";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";

export const auditRouter = Router();
auditRouter.use(authMiddleware, requireTenant);

auditRouter.get("/", requirePermission("audit_logs", "read"), async (req, res) => {
  const page = parseInt((req.query.page as string) ?? "1", 10);
  const pageSize = 50;
  const logs = await prisma.auditLog.findMany({
    where: { hospitalId: req.tenantHospitalId! },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { user: { select: { email: true, firstName: true, lastName: true } } },
  });
  res.json(logs);
});
