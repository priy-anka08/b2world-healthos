import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createDocument, getDocument, listDocuments } from "./documents.service";

export const documentsRouter = Router();
documentsRouter.use(authMiddleware, requireTenant);

documentsRouter.get("/", requirePermission("documents", "read"), async (req, res) => {
  res.json(await listDocuments(req.tenantHospitalId!));
});

documentsRouter.get("/:id", requirePermission("documents", "read"), async (req, res) => {
  const doc = await getDocument(req.tenantHospitalId!, req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  res.json(doc);
});

const createSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["sop", "policy", "guideline", "equipment_manual", "department_doc"]),
  content: z.string().min(1),
});

documentsRouter.post("/", requirePermission("documents", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const doc = await createDocument({
      hospitalId: req.tenantHospitalId!,
      uploadedByUserId: req.auth!.userId,
      ...body,
    });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "document.create",
      resourceId: doc.id,
    });
    res.status(201).json({ id: doc.id, title: doc.title, category: doc.category });
  } catch (err) {
    next(err);
  }
});