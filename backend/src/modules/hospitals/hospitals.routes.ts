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

// --- White-label branding (spec Phase 6) ---
const brandingSchema = z.object({
  logoEmoji: z.string().max(4).optional(),
  primaryColorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use hex format, e.g. #5F8F8B").optional(),
  displayName: z.string().max(60).optional(),
});

hospitalsRouter.get("/:id/branding", async (req, res) => {
  const hospital = await prisma.hospital.findUnique({ where: { id: req.params.id }, select: { name: true, branding: true } });
  if (!hospital) return res.status(404).json({ error: "Not found" });
  res.json({ hospitalName: hospital.name, branding: hospital.branding ?? {} });
});

hospitalsRouter.patch("/:id/branding", async (req, res, next) => {
  try {
    if (!req.auth!.isSuperAdmin) {
      const membership = await prisma.userHospital.findFirst({
        where: { userId: req.auth!.userId, hospitalId: req.params.id },
        include: { role: true },
      });
      if (!membership || membership.role.name !== "HOSPITAL_ADMIN") {
        return res.status(403).json({ error: "Hospital admin access required" });
      }
    }
    const body = brandingSchema.parse(req.body);
    const hospital = await prisma.hospital.update({ where: { id: req.params.id }, data: { branding: body } });
    await writeAuditLog({ hospitalId: req.params.id, userId: req.auth!.userId, action: "hospital.branding_update" });
    res.json({ hospitalName: hospital.name, branding: hospital.branding });
  } catch (err) {
    next(err);
  }
});