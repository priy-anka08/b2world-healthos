import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import {
  detectInventoryAnomalies,
  detectRevenueAnomaly,
  forecastBedOccupancy,
  forecastLabTurnaround,
  getRevenueAnalytics,
  suggestReorders,
} from "./ai-predictions.service";

export const aiPredictionsRouter = Router();
aiPredictionsRouter.use(authMiddleware, requireTenant);

aiPredictionsRouter.get("/bed-occupancy", requirePermission("beds", "read"), async (req, res) => {
  res.json(await forecastBedOccupancy(req.tenantHospitalId!));
});

aiPredictionsRouter.get("/inventory-reorder", requirePermission("pharmacy", "read"), async (req, res) => {
  res.json(await suggestReorders(req.tenantHospitalId!));
});

aiPredictionsRouter.get("/revenue-analytics", requirePermission("billing", "read"), async (req, res) => {
  res.json(await getRevenueAnalytics(req.tenantHospitalId!));
});

aiPredictionsRouter.get("/revenue-anomaly", requirePermission("billing", "read"), async (req, res) => {
  res.json(await detectRevenueAnomaly(req.tenantHospitalId!));
});

aiPredictionsRouter.get("/lab-turnaround", requirePermission("laboratory", "read"), async (req, res) => {
  res.json(await forecastLabTurnaround(req.tenantHospitalId!));
});

aiPredictionsRouter.get("/inventory-anomalies", requirePermission("pharmacy", "read"), async (req, res) => {
  res.json(await detectInventoryAnomalies(req.tenantHospitalId!));
});