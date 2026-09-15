import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createClinicalNote, listClinicalNotes } from "./clinical-notes.service";

export const clinicalNotesRouter = Router();
clinicalNotesRouter.use(authMiddleware, requireTenant);

clinicalNotesRouter.get("/", requirePermission("clinical_notes", "read"), async (req, res, next) => {
  try {
    const encounterId = z.string().uuid().parse(req.query.encounterId);
    res.json(await listClinicalNotes(req.tenantHospitalId!, encounterId));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

const createSchema = z.object({
  encounterId: z.string().uuid(),
  chiefComplaint: z.string().optional(),
  history: z.string().optional(),
  observations: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

clinicalNotesRouter.post("/", requirePermission("clinical_notes", "create"), async (req, res, next) => {
  try {
    const { encounterId, ...content } = createSchema.parse(req.body);
    const note = await createClinicalNote(req.tenantHospitalId!, encounterId, req.auth!.userId, content);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "clinical_note.create",
      resourceId: note.id,
    });
    res.status(201).json(note);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});