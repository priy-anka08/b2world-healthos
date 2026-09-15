import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { hashPassword } from "@/modules/auth/auth.service";
import { writeAuditLog } from "@/common/utils/audit";

export const usersRouter = Router();
usersRouter.use(authMiddleware, requireTenant);

usersRouter.get("/", requirePermission("users", "read"), async (req, res) => {
  const members = await prisma.userHospital.findMany({
    where: { hospitalId: req.tenantHospitalId! },
    include: { user: true, role: true },
  });
  res.json(
    members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.role.name,
      status: m.user.status,
      mfaEnabled: m.user.mfaEnabled,
    }))
  );
});

const inviteSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  temporaryPassword: z.string().min(8),
  role: z.enum([
    "HOSPITAL_ADMIN",
    "DOCTOR",
    "NURSE",
    "RECEPTIONIST",
    "PHARMACIST",
    "LAB_TECHNICIAN",
    "ACCOUNTANT",
  ]),
});

usersRouter.post("/", requirePermission("users", "create"), async (req, res, next) => {
  try {
    const body = inviteSchema.parse(req.body);
    const role = await prisma.role.findUnique({ where: { name: body.role } });
    if (!role) return res.status(400).json({ error: "Unknown role" });

    const passwordHash = await hashPassword(body.temporaryPassword);
    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: {},
      create: {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        passwordHash,
      },
    });

    await prisma.userHospital.create({
      data: { userId: user.id, hospitalId: req.tenantHospitalId!, roleId: role.id },
    });

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "user.invite",
      resourceId: user.id,
      metadata: { role: body.role },
    });

    res.status(201).json({ id: user.id, email: user.email, role: body.role });
  } catch (err) {
    next(err);
  }
});

// Admin-triggered password reset (spec §37 hardening item). No email
// delivery yet — the admin communicates the new temporary password out of
// band. A real deployment should force a change on next login; flagged as
// a follow-up, not blocking for the MVP.
const resetPasswordSchema = z.object({ newPassword: z.string().min(8) });

usersRouter.post("/:id/reset-password", requirePermission("users", "create"), async (req, res, next) => {
  try {
    const { newPassword } = resetPasswordSchema.parse(req.body);

    const membership = await prisma.userHospital.findFirst({
      where: { userId: req.params.id, hospitalId: req.tenantHospitalId! },
    });
    if (!membership) return res.status(404).json({ error: "User not found in this hospital" });

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "user.password_reset",
      resourceId: req.params.id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});