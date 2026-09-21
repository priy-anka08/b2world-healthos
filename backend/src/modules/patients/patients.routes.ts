import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import {
  createPatient,
  exportPatientData,
  findPossibleDuplicates,
  getPatientById,
  listConsents,
  listPatients,
  setConsent,
} from "./patients.service";

export const patientsRouter = Router();
patientsRouter.use(authMiddleware, requireTenant);

const createSchema = z.object({
  patientCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.coerce.date().optional(),
  gender: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  bloodGroup: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  acknowledgedDuplicates: z.boolean().optional(),
});

patientsRouter.get("/", requirePermission("patients", "read"), async (req, res) => {
  const patients = await listPatients(req.tenantHospitalId!, req.query.search as string | undefined);
  res.json(patients);
});

patientsRouter.get("/:id", requirePermission("patients", "read"), async (req, res) => {
  const patient = await getPatientById(req.tenantHospitalId!, req.params.id);
  if (!patient) return res.status(404).json({ error: "Not found" });
  await writeAuditLog({
    hospitalId: req.tenantHospitalId,
    userId: req.auth!.userId,
    action: "patient.view",
    resourceType: "patient",
    resourceId: patient.id,
  });
  res.json(patient);
});

patientsRouter.post("/", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);

    if (!body.acknowledgedDuplicates) {
      const duplicates = await findPossibleDuplicates(req.tenantHospitalId!, body);
      if (duplicates.length > 0) {
        return res.status(409).json({
          warning: "Possible duplicate patient record",
          duplicates,
          hint: "Resubmit with acknowledgedDuplicates: true to proceed anyway.",
        });
      }
    }

    const patient = await createPatient({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "patient.create",
      resourceId: patient.id,
    });
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

const consentSchema = z.object({
  type: z.enum(["data_sharing", "treatment", "ai_processing"]),
  granted: z.boolean(),
});

patientsRouter.post("/:id/consents", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = consentSchema.parse(req.body);
    const consent = await setConsent(req.tenantHospitalId!, req.params.id, body.type, body.granted);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "patient.consent_set",
      resourceId: req.params.id,
      metadata: { type: body.type, granted: body.granted },
    });
    res.status(201).json(consent);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

patientsRouter.get("/:id/consents", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    res.json(await listConsents(req.tenantHospitalId!, req.params.id));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

patientsRouter.get("/:id/export", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    const data = await exportPatientData(req.tenantHospitalId!, req.params.id);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "patient.data_export",
      resourceId: req.params.id,
    });
    res.json(data);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});