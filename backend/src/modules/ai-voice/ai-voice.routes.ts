import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { transcribeAndAsk } from "./ai-voice.service";

export const aiVoiceRouter = Router();
aiVoiceRouter.use(authMiddleware, requireTenant);

const schema = z.object({
  audioBase64: z.string().min(1),
  language: z.string().optional(),
});

// Reuses the "ai_copilot" permission — voice is just a spoken question to
// the same read-only copilot, so no new permission row needs seeding.
aiVoiceRouter.post("/transcribe", requirePermission("ai_copilot", "read"), async (req, res, next) => {
  try {
    const body = schema.parse(req.body);
    const result = await transcribeAndAsk({ hospitalId: req.tenantHospitalId!, userId: req.auth!.userId, ...body });
    res.json(result);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});