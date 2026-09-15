import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { askCopilot } from "./ai-copilot.service";

export const aiCopilotRouter = Router();
aiCopilotRouter.use(authMiddleware, requireTenant);

const querySchema = z.object({ question: z.string().min(1) });

aiCopilotRouter.post("/query", requirePermission("ai_copilot", "read"), async (req, res, next) => {
  try {
    const { question } = querySchema.parse(req.body);
    const result = await askCopilot(req.tenantHospitalId!, req.auth!.userId, question);
    res.json(result);
  } catch (err) {
    next(err);
  }
});