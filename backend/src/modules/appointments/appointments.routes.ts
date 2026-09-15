import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { bookAppointment, estimateNoShowRisk, estimateWaitMinutes, listAppointments } from "./appointments.service";
import { AppError } from "@/common/errors/error-handler";

export const appointmentsRouter = Router();
appointmentsRouter.use(authMiddleware, requireTenant);

const bookSchema = z.object({
  patientId: z.string().uuid(),
  practitionerId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date(),
  durationMins: z.number().int().positive().optional(),
});

appointmentsRouter.get("/", requirePermission("appointments", "read"), async (req, res) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const appointments = await listAppointments(req.tenantHospitalId!, {
    date,
    practitionerId: req.query.practitionerId as string | undefined,
  });
  res.json(appointments);
});

appointmentsRouter.post("/", requirePermission("appointments", "create"), async (req, res, next) => {
  try {
    const body = bookSchema.parse(req.body);
    const appointment = await bookAppointment({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "appointment.book",
      resourceId: appointment.id,
    });
    res.status(201).json(appointment);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return next(new AppError((err as never as { statusCode: number }).statusCode, err.message));
    }
    next(err);
  }
});

appointmentsRouter.get("/:id/queue-estimate", requirePermission("appointments", "read"), async (req, res, next) => {
  try {
    const appt = await import("@/config/prisma").then((m) =>
      m.prisma.appointment.findFirst({ where: { id: req.params.id, hospitalId: req.tenantHospitalId! } })
    );
    if (!appt) return res.status(404).json({ error: "Not found" });
    const estimate = await estimateWaitMinutes(req.tenantHospitalId!, appt.practitionerId, appt.id);
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

appointmentsRouter.get("/:id/no-show-risk", requirePermission("appointments", "read"), async (req, res, next) => {
  try {
    const result = await estimateNoShowRisk(req.tenantHospitalId!, req.params.id);
    res.json(result);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return next(new AppError((err as never as { statusCode: number }).statusCode, err.message));
    }
    next(err);
  }
});