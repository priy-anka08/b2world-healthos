import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { bedSummary, createBed, createRoom, createWard, listWards, setBedStatus } from "./beds.service";

export const bedsRouter = Router();
bedsRouter.use(authMiddleware, requireTenant);

bedsRouter.get("/wards", requirePermission("beds", "read"), async (req, res) => {
  res.json(await listWards(req.tenantHospitalId!));
});

bedsRouter.get("/summary", requirePermission("beds", "read"), async (req, res) => {
  res.json(await bedSummary(req.tenantHospitalId!));
});

bedsRouter.post("/wards", requirePermission("beds", "create"), async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const ward = await createWard(req.tenantHospitalId!, name);
    res.status(201).json(ward);
  } catch (err) {
    next(err);
  }
});

bedsRouter.post("/wards/:wardId/rooms", requirePermission("beds", "create"), async (req, res, next) => {
  try {
    const { number } = z.object({ number: z.string().min(1) }).parse(req.body);
    const room = await createRoom(req.tenantHospitalId!, req.params.wardId, number);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
});

bedsRouter.post("/rooms/:roomId/beds", requirePermission("beds", "create"), async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const bed = await createBed(req.tenantHospitalId!, req.params.roomId, code);
    res.status(201).json(bed);
  } catch (err) {
    next(err);
  }
});

bedsRouter.post("/beds/:bedId/status", requirePermission("beds", "create"), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const bed = await setBedStatus(req.tenantHospitalId!, req.params.bedId, status);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "beds.bed.status_change",
      resourceId: bed.id,
      metadata: { status },
    });
    res.json(bed);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});