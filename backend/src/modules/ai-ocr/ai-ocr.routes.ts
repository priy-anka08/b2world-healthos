import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";

/**
 * STUB MODULE — Phase 4
 *
 * Document OCR + classification + extraction pipeline (spec section 12). Suggested stack: PaddleOCR, called via the ai-service (Python) — see /ai-service.
 *
 * Follow the same pattern as the fully-built `patients` or `appointments`
 * modules in this repo:
 *   1. Write a `*.service.ts` with plain functions that always filter by
 *      `hospitalId` first in every Prisma query (see tenant.middleware.ts).
 *   2. Wire routes here behind `authMiddleware`, `requireTenant`, and
 *      `requirePermission("ai_ocr", "<action>")`.
 *   3. Call `writeAuditLog(...)` for every read/write of sensitive data.
 *   4. Add integration tests proving cross-tenant access is blocked.
 *
 * Remove the 501 stub handler below once implemented.
 */
export const stubRouter = Router();
stubRouter.use(authMiddleware, requireTenant);

stubRouter.all("*", (_req, res) => {
  res.status(501).json({
    error: "Not implemented yet",
    module: "ai-ocr",
    phase: "Phase 4",
  });
});
