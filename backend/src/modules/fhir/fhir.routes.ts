import { Router } from "express";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { getFhirPatient } from "./fhir.service";

export const fhirRouter = Router();
fhirRouter.use(authMiddleware, requireTenant);

fhirRouter.get("/Patient/:id", requirePermission("patients", "read"), async (req, res) => {
  const resource = await getFhirPatient(req.tenantHospitalId!, req.params.id);
  if (!resource) {
    return res.status(404).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }],
    });
  }
  res.json(resource);
});