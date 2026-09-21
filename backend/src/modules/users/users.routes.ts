import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { hashPassword } from "@/modules/auth/auth.service";
import { writeAuditLog } from "@/common/utils/audit";
import { countOrgSeats, getActiveSubscription } from "@/modules/subscriptions/subscriptions.service";

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
  role: z.enum(["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "ACCOUNTANT"]),
});

usersRouter.post("/", requirePermission("users", "create"), async (req, res, next) => {
  try {
    const body = inviteSchema.parse(req.body);

    // Seat-limit check (spec Phase 6 "usage limits"). Seats are counted
    // org-wide (not per-hospital) since a Subscription belongs to the
    // Organization, not a single Hospital.
    const hospital = await prisma.hospital.findUnique({
      where: { id: req.tenantHospitalId! },
      select: { organizationId: true },
    });
    if (hospital) {
      const subscription = await getActiveSubscription(hospital.organizationId);
      if (subscription?.seatLimit) {
        const currentSeats = await countOrgSeats(hospital.organizationId);
        if (currentSeats >= subscription.seatLimit) {
          return res.status(402).json({
            error: `Seat limit reached (${subscription.seatLimit} on the "${subscription.planName}" plan). Upgrade the subscription to add more staff.`,
          });
        }
      }
    }

    const role = await prisma.role.findUnique({ where: { name: body.role } });
    if (!role) return res.status(400).json({ error: "Unknown role" });

    const passwordHash = await hashPassword(body.temporaryPassword);
    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: {},
      create: { email: body.email, firstName: body.firstName, lastName: body.lastName, passwordHash },
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

const statusSchema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

usersRouter.patch("/:id/status", requirePermission("users", "create"), async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const membership = await prisma.userHospital.findFirst({
      where: { userId: req.params.id, hospitalId: req.tenantHospitalId! },
    });
    if (!membership) return res.status(404).json({ error: "User not found in this hospital" });

    if (req.params.id === req.auth!.userId && status === "INACTIVE") {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    await prisma.user.update({ where: { id: req.params.id }, data: { status } });

    if (status === "INACTIVE") {
      const { createClient } = await import("redis");
      const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
      await redis.connect();
      await redis.set(`session:revoked:${req.params.id}`, "1", { EX: 8 * 60 * 60 });
      await redis.disconnect();
    } else {
      const { createClient } = await import("redis");
      const redis = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
      await redis.connect();
      await redis.del(`session:revoked:${req.params.id}`);
      await redis.disconnect();
    }

    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: status === "INACTIVE" ? "user.deactivate" : "user.reactivate",
      resourceId: req.params.id,
    });

    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
});