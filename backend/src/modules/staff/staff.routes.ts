import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createStaff, listStaff } from "./staff.service";
import { generateScheduleSuggestion, applySchedule } from "./staff-scheduling.service";

export const staffRouter = Router();
staffRouter.use(authMiddleware, requireTenant);

staffRouter.get("/", requirePermission("staff", "read"), async (req, res) => {
  res.json(await listStaff(req.tenantHospitalId!));
});

const createSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  temporaryPassword: z.string().min(8),
  jobTitle: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  role: z.enum(["NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT"]),
});

staffRouter.post("/", requirePermission("staff", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const staff = await createStaff({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "staff.create",
      resourceId: staff.id,
      metadata: { role: body.role },
    });
    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});

// ─── Staff Scheduling Suggestion (spec §27) ───
const scheduleQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departmentId: z.string().uuid().optional(),
});

staffRouter.post("/schedule/suggest", requirePermission("staff", "create"), async (req, res, next) => {
  try {
    const body = scheduleQuerySchema.parse(req.body);
    const suggestion = await generateScheduleSuggestion({
      hospitalId: req.tenantHospitalId!,
      date: body.date,
      departmentId: body.departmentId,
    });

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "staff.schedule_suggest",
      metadata: { date: body.date, departmentId: body.departmentId },
    });

    res.json(suggestion);
  } catch (err) {
    next(err);
  }
});

// ─── Apply approved schedule ───
const applySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shifts: z.array(
    z.object({
      staffId: z.string().uuid(),
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(0).max(23),
    })
  ),
});

staffRouter.post("/schedule/apply", requirePermission("staff", "create"), async (req, res, next) => {
  try {
    const body = applySchema.parse(req.body);
    const created = await applySchedule(req.tenantHospitalId!, body.date, body.shifts);

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "staff.schedule_apply",
      metadata: { date: body.date, shiftsCreated: created.length },
    });

    res.status(201).json({ shiftsCreated: created.length, shifts: created });
  } catch (err) {
    next(err);
  }
});
