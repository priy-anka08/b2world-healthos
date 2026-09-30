import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import {
  createPatient,
  exportPatientData,
  findPossibleDuplicates,
  getPatientById,
  getRegistrationReceipt,
  listConsents,
  listPatientDocuments,
  listPatients,
  mergePatients,
  setConsent,
  updatePatient,
  uploadPatientDocument,
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
  // Spec §3 — a Nurse only sees "assigned patients". Scoped here via the
  // nurse's own department (from their Staff record), not a fully manual
  // per-patient assignment, since that's the finest granularity the
  // current schema supports without a new table.
  let departmentScope: string | undefined;
  if (req.auth!.role === "NURSE") {
    const staff = await prisma.staff.findFirst({ where: { userId: req.auth!.userId, hospitalId: req.tenantHospitalId! } });
    departmentScope = staff?.departmentId ?? undefined;
  }
  res.json(await listPatients(req.tenantHospitalId!, req.query.search as string | undefined, departmentScope));
});

patientsRouter.get("/:id", requirePermission("patients", "read"), async (req, res) => {
  const patient = await getPatientById(req.tenantHospitalId!, req.params.id);
  if (!patient) return res.status(404).json({ error: "Not found" });
  await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.view", resourceId: patient.id });
  res.json(patient);
});

patientsRouter.post("/", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    if (!body.acknowledgedDuplicates) {
      const duplicates = await findPossibleDuplicates(req.tenantHospitalId!, body);
      if (duplicates.length > 0) {
        return res.status(409).json({ warning: "Possible duplicate patient record", duplicates, hint: "Resubmit with acknowledgedDuplicates: true to proceed anyway." });
      }
    }
    const patient = await createPatient({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.create", resourceId: patient.id });
    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
});

const updateSchema = createSchema.partial().omit({ patientCode: true, acknowledgedDuplicates: true });

patientsRouter.patch("/:id", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const patient = await updatePatient(req.tenantHospitalId!, req.params.id, body);
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.update", resourceId: patient.id });
    res.json(patient);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

patientsRouter.get("/:id/receipt", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    res.json(await getRegistrationReceipt(req.tenantHospitalId!, req.params.id));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

const uploadDocSchema = z.object({
  type: z.enum(["prescription", "lab_report", "discharge_summary", "referral", "id_proof", "other"]),
  fileUrl: z.string().min(1),
});

patientsRouter.get("/:id/documents", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    res.json(await listPatientDocuments(req.tenantHospitalId!, req.params.id));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

patientsRouter.post("/:id/documents", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = uploadDocSchema.parse(req.body);
    const doc = await uploadPatientDocument(req.tenantHospitalId!, req.params.id, req.auth!.userId, body.type, body.fileUrl);
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.document_upload", resourceId: doc.id });
    res.status(201).json(doc);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

const consentSchema = z.object({ type: z.enum(["data_sharing", "treatment", "ai_processing"]), granted: z.boolean() });

patientsRouter.post("/:id/consents", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const body = consentSchema.parse(req.body);
    const consent = await setConsent(req.tenantHospitalId!, req.params.id, body.type, body.granted);
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.consent_set", resourceId: req.params.id, metadata: { type: body.type, granted: body.granted } });
    res.status(201).json(consent);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

patientsRouter.get("/:id/consents", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    res.json(await listConsents(req.tenantHospitalId!, req.params.id));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

patientsRouter.get("/:id/export", requirePermission("patients", "read"), async (req, res, next) => {
  try {
    const data = await exportPatientData(req.tenantHospitalId!, req.params.id);
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.data_export", resourceId: req.params.id });
    res.json(data);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});

patientsRouter.post("/:id/merge", requirePermission("patients", "create"), async (req, res, next) => {
  try {
    const { duplicateId } = z.object({ duplicateId: z.string().uuid() }).parse(req.body);
    const merged = await mergePatients(req.tenantHospitalId!, req.params.id, duplicateId);
    await writeAuditLog({ hospitalId: req.tenantHospitalId, userId: req.auth!.userId, action: "patient.merge", resourceId: req.params.id, metadata: { duplicateId } });
    res.json(merged);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});