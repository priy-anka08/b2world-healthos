import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { ingestDocument, queryRAG, listIngestedDocuments } from "./ai-rag.service";

export const aiRagRouter = Router();
aiRagRouter.use(authMiddleware, requireTenant);

// ─── Query the RAG assistant ───
const querySchema = z.object({
  question: z.string().min(3).max(1000),
  topK: z.number().int().min(1).max(20).optional(),
});

aiRagRouter.post("/query", requirePermission("ai_rag", "read"), async (req, res, next) => {
  try {
    const body = querySchema.parse(req.body);
    const result = await queryRAG({
      hospitalId: req.tenantHospitalId!,
      userId: req.auth!.userId,
      question: body.question,
      topK: body.topK,
    });

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "ai_rag.query",
      metadata: { question: body.question.slice(0, 100) },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── Ingest a document into the RAG system ───
const ingestSchema = z.object({
  documentId: z.string().uuid(),
  fileContent: z.string().min(1),
});

aiRagRouter.post("/ingest", requirePermission("ai_rag", "create"), async (req, res, next) => {
  try {
    const body = ingestSchema.parse(req.body);
    const result = await ingestDocument({
      hospitalId: req.tenantHospitalId!,
      documentId: body.documentId,
      title: "",
      fileContent: body.fileContent,
    });

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "ai_rag.ingest",
      resourceId: body.documentId,
      metadata: { chunksCreated: result.chunksCreated },
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ─── List ingested documents ───
aiRagRouter.get("/documents", requirePermission("ai_rag", "read"), async (req, res) => {
  const docs = await listIngestedDocuments(req.tenantHospitalId!);
  res.json(docs);
});
