import { Router } from "express";
import { z } from "zod";
import { prisma } from "@/config/prisma";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { writeAuditLog } from "@/common/utils/audit";

export const organizationsRouter = Router();

function requireSuperAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.auth?.isSuperAdmin) return res.status(403).json({ error: "Super admin only" });
  next();
}

organizationsRouter.use(authMiddleware, requireSuperAdmin);

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
});

organizationsRouter.get("/", async (_req, res) => {
  const orgs = await prisma.organization.findMany({ include: { hospitals: true } });
  res.json(orgs);
});

organizationsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const org = await prisma.organization.create({ data: body });
    await writeAuditLog({ userId: req.auth!.userId, action: "organization.create", resourceId: org.id });
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
});

organizationsRouter.get("/:id", async (req, res) => {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: { hospitals: true, subscriptions: true },
  });
  if (!org) return res.status(404).json({ error: "Not found" });
  res.json(org);
});
