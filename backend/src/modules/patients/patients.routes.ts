import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createPatient, findPossibleDuplicates, getPatientById, listPatients } from "./patients.service";

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
  acknowledgedDuplicates: z.boolean().optional(), // set true once staff reviewed the duplicate list
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

// Two-step create: first call without acknowledgedDuplicates to get
// candidates back for staff review; call again with acknowledgedDuplicates
// once they've confirmed it's genuinely a new patient (spec §5).
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
