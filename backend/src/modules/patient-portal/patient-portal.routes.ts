import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { completeLogin } from "@/modules/auth/auth.service";
import { askPatientAssistant, bookMyAppointment, getMyPortalData, invitePortalAccess, listPractitionersForBooking, registerPatient } from "./patient-portal.service";
export const patientPortalRouter = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});

const registerSchema = z.object({
  hospitalCode: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  dob: z.coerce.date().optional(),
});

patientPortalRouter.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await registerPatient(body);
    const loginResult = await completeLogin(result.userId, result.hospitalId);

    await writeAuditLog({
      hospitalId: result.hospitalId,
      userId: result.userId,
      action: "patient_portal.self_register",
      resourceId: result.patientId,
    });

    res.status(201).json({ ...loginResult, patientCode: result.patientCode });
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

patientPortalRouter.post(
  "/invite/:patientId",
  authMiddleware,
  requireTenant,
  requirePermission("patients", "create"),
  async (req, res, next) => {
    try {
      const { email, temporaryPassword } = z
        .object({ email: z.string().email(), temporaryPassword: z.string().min(8) })
        .parse(req.body);
      const result = await invitePortalAccess({
        hospitalId: req.tenantHospitalId!,
        patientId: req.params.patientId,
        email,
        temporaryPassword,
      });
      await writeAuditLog({
        hospitalId: req.tenantHospitalId,
        userId: req.auth!.userId,
        action: "patient_portal.invite",
        resourceId: result.userId,
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
      }
      next(err);
    }
  }
);

patientPortalRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    res.json(await getMyPortalData(req.auth!.userId));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

patientPortalRouter.post("/assistant/ask", authMiddleware, async (req, res, next) => {
  try {
    const { question } = z.object({ question: z.string().min(1) }).parse(req.body);
    res.json(await askPatientAssistant(req.auth!.userId, question));
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

patientPortalRouter.get("/practitioners", authMiddleware, async (req, res, next) => {
  try {
    const { prisma } = await import("@/config/prisma");
    const patient = await prisma.patient.findUnique({ where: { userId: req.auth!.userId } });
    if (!patient) return res.status(404).json({ error: "No patient record linked to this account" });
    res.json(await listPractitionersForBooking(patient.hospitalId));
  } catch (err) {
    next(err);
  }
});

const bookSchema = z.object({ practitionerId: z.string().uuid(), scheduledAt: z.coerce.date(), durationMins: z.number().int().positive().optional() });

patientPortalRouter.post("/book-appointment", authMiddleware, async (req, res, next) => {
  try {
    const body = bookSchema.parse(req.body);
    const appt = await bookMyAppointment(req.auth!.userId, body.practitionerId, body.scheduledAt, body.durationMins);
    res.status(201).json(appt);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    next(err);
  }
});