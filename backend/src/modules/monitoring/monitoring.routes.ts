import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { getPlatformSummary } from "./monitoring.service";

export const monitoringRouter = Router();

// Platform-wide (not hospital-scoped) — deliberately restricted to super
// admins only, checked directly rather than via requirePermission, since
// this endpoint has no hospital context to scope a role permission to.
monitoringRouter.get("/summary", authMiddleware, async (req, res) => {
  if (!req.auth!.isSuperAdmin) return res.status(403).json({ error: "Super admin only" });
  res.json(await getPlatformSummary());
});