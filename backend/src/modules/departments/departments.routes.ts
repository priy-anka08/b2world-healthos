import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";

export const departmentsRouter = Router();
departmentsRouter.use(authMiddleware, requireTenant);

departmentsRouter.get("/", requirePermission("departments", "read"), async (req, res) => {
  res.json(await prisma.department.findMany({ where: { hospitalId: req.tenantHospitalId! } }));
});

departmentsRouter.post("/", requirePermission("departments", "create"), async (req, res, next) => {
  try {
    const body = z.object({ name: z.string().min(1), code: z.string().min(1) }).parse(req.body);
    const dept = await prisma.department.create({ data: { ...body, hospitalId: req.tenantHospitalId! } });
    res.status(201).json(dept);
  } catch (err) {
    next(err);
  }
});
