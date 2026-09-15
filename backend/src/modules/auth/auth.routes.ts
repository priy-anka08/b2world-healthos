import { Router } from "express";
import { z } from "zod";
import { login, verifyMfaAndLogin, setupMfa, enableMfa, disableMfa } from "./auth.service";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { writeAuditLog } from "@/common/utils/audit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  hospitalId: z.string().uuid().optional(),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body.email, body.password, body.hospitalId);
    if (!result.mfaRequired) {
      await writeAuditLog({
        userId: result.user?.id,
        hospitalId: body.hospitalId,
        action: "auth.login",
        ipAddress: req.ip,
      });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const mfaVerifyLoginSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().length(6),
  hospitalId: z.string().uuid().optional(),
});

authRouter.post("/mfa/verify-login", async (req, res, next) => {
  try {
    const body = mfaVerifyLoginSchema.parse(req.body);
    const result = await verifyMfaAndLogin(body.userId, body.token, body.hospitalId);
    await writeAuditLog({
      userId: result.user?.id,
      hospitalId: body.hospitalId,
      action: "auth.mfa_login",
      ipAddress: req.ip,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/mfa/setup", authMiddleware, async (req, res, next) => {
  try {
    const result = await setupMfa(req.auth!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/mfa/enable", authMiddleware, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const result = await enableMfa(req.auth!.userId, token);
    await writeAuditLog({ userId: req.auth!.userId, action: "auth.mfa_enable" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/mfa/disable", authMiddleware, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().length(6) }).parse(req.body);
    const result = await disableMfa(req.auth!.userId, token);
    await writeAuditLog({ userId: req.auth!.userId, action: "auth.mfa_disable" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Re-issue a hospital-scoped token once the client picks from the
// multi-hospital list returned by /login.
authRouter.post("/select-hospital", authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({ hospitalId: z.string().uuid() });
    const { hospitalId } = schema.parse(req.body);
    const { prisma } = await import("@/config/prisma");
    const { default: jwt } = await import("jsonwebtoken");
    const { env } = await import("@/config/env");

    const membership = await prisma.userHospital.findFirst({
      where: { userId: req.auth!.userId, hospitalId },
      include: { role: true },
    });
    if (!membership) {
      return res.status(403).json({ error: "No access to this hospital" });
    }

    const token = jwt.sign(
      {
        userId: req.auth!.userId,
        isSuperAdmin: req.auth!.isSuperAdmin,
        hospitalId,
        organizationId: req.auth!.organizationId,
        role: membership.role.name,
      },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn as never }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authMiddleware, async (req, res) => {
  res.json({ auth: req.auth });
});