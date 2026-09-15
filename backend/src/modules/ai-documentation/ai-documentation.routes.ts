import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { draftClinicalNote } from "./ai-documentation.service";

export const aiDocumentationRouter = Router();
aiDocumentationRouter.use(authMiddleware, requireTenant);

const draftSchema = z.object({
  encounterId: z.string().uuid(),
  rawNotes: z.string().min(1),
});

aiDocumentationRouter.post("/draft", requirePermission("clinical_notes", "create"), async (req, res, next) => {
  try {
    const body = draftSchema.parse(req.body);
    const result = await draftClinicalNote({
      hospitalId: req.tenantHospitalId!,
      userId: req.auth!.userId,
      ...body,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});