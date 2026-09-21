import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { orchestrate } from "./ai-orchestrator.service";

export const aiOrchestratorRouter = Router();
aiOrchestratorRouter.use(authMiddleware, requireTenant);

const schema = z.object({ question: z.string().min(1) });

aiOrchestratorRouter.post("/query", requirePermission("ai_copilot", "read"), async (req, res, next) => {
  try {
    const { question } = schema.parse(req.body);
    res.json(await orchestrate(req.tenantHospitalId!, req.auth!.userId, question));
  } catch (err) {
    next(err);
  }
});