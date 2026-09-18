import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { extractDocument, listPendingVerification, verifyExtraction } from "./ai-ocr.service";

export const aiOcrRouter = Router();
aiOcrRouter.use(authMiddleware, requireTenant);

const extractSchema = z.object({
  patientId: z.string().uuid(),
  documentType: z.enum(["prescription", "lab_report", "discharge_summary", "referral"]).optional(),
  imageBase64: z.string().min(1),
});

aiOcrRouter.post("/extract", requirePermission("ai_ocr", "create"), async (req, res, next) => {
  try {
    const body = extractSchema.parse(req.body);
    const result = await extractDocument({ hospitalId: req.tenantHospitalId!, userId: req.auth!.userId, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "ai_ocr.extract",
      resourceId: result.patientDocumentId,
      metadata: { patientId: body.patientId },
    });
    res.json(result);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

aiOcrRouter.get("/pending", requirePermission("ai_ocr", "read"), async (req, res) => {
  res.json(await listPendingVerification(req.tenantHospitalId!));
});

const verifySchema = z.object({ correctedData: z.record(z.unknown()).optional() });

// Gated behind "create" (not just "read") since this is a write that
// commits a draft into the trusted record — same coarse read/create model
// the rest of this repo uses. RECEPTIONIST is not granted ai_ocr at all in
// the seed below, so only HOSPITAL_ADMIN/DOCTOR can reach this.
aiOcrRouter.post("/:id/verify", requirePermission("ai_ocr", "create"), async (req, res, next) => {
  try {
    const body = verifySchema.parse(req.body);
    const updated = await verifyExtraction({
      hospitalId: req.tenantHospitalId!,
      userId: req.auth!.userId,
      patientDocumentId: req.params.id,
      correctedData: body.correctedData,
    });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "ai_ocr.verify",
      resourceId: updated.id,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});