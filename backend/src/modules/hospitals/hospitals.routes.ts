import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { writeAuditLog } from "@/common/utils/audit";

export const hospitalsRouter = Router();
hospitalsRouter.use(authMiddleware);

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  code: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

// Hospital onboarding — super admin action (spec §41, Phase 1 & 6)
hospitalsRouter.post("/", async (req, res, next) => {
  try {
    if (!req.auth?.isSuperAdmin) return res.status(403).json({ error: "Super admin only" });
    const body = createSchema.parse(req.body);
    const hospital = await prisma.hospital.create({ data: body });
    await writeAuditLog({ userId: req.auth.userId, action: "hospital.create", resourceId: hospital.id });
    res.status(201).json(hospital);
  } catch (err) {
    next(err);
  }
});

// A logged-in user only sees hospitals they belong to (or all, if super admin)
hospitalsRouter.get("/", async (req, res) => {
  if (req.auth?.isSuperAdmin) {
    return res.json(await prisma.hospital.findMany());
  }
  const memberships = await prisma.userHospital.findMany({
    where: { userId: req.auth!.userId },
    include: { hospital: true, role: true },
  });
  res.json(memberships.map((m) => ({ ...m.hospital, myRole: m.role.name })));
});
