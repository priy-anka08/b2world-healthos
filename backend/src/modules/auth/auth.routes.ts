import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  login,
  verifyMfaAndLogin,
  setupMfa,
  enableMfa,
  disableMfa,
  requestPasswordReset,
  resetPassword,
} from "./auth.service";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { writeAuditLog } from "@/common/utils/audit";

export const authRouter = Router();

// Spec §37 hardening: dedicated brute-force protection on the endpoints an
// attacker would actually hammer (login, MFA code guessing, password-reset
// requests) — much tighter than the app-wide 500/15min limiter in app.ts.
const authBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a few minutes." },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  hospitalId: z.string().uuid().optional(),
});

authRouter.post("/login", authBruteForceLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await login(body.email, body.password, body.hospitalId);
    if (!result.mfaRequired) {
      await writeAuditLog({ userId: result.user?.id, hospitalId: body.hospitalId, action: "auth.login", ipAddress: req.ip });
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

authRouter.post("/mfa/verify-login", authBruteForceLimiter, async (req, res, next) => {
  try {
    const body = mfaVerifyLoginSchema.parse(req.body);
    const result = await verifyMfaAndLogin(body.userId, body.token, body.hospitalId);
    await writeAuditLog({ userId: result.user?.id, hospitalId: body.hospitalId, action: "auth.mfa_login", ipAddress: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/mfa/setup", authMiddleware, async (req, res, next) => {
  try {
    res.json(await setupMfa(req.auth!.userId));
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
    if (!membership) return res.status(403).json({ error: "No access to this hospital" });

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

authRouter.get("/permissions", authMiddleware, async (req, res) => {
  if (req.auth!.isSuperAdmin) return res.json({ permissions: ["*"] });
  if (!req.auth!.role) return res.json({ permissions: [] });

  const { prisma } = await import("@/config/prisma");
  const role = await prisma.role.findUnique({
    where: { name: req.auth!.role as never },
    include: { permissions: { include: { permission: true } } },
  });
  const permissions = role?.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`) ?? [];
  res.json({ permissions });
});

authRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    const { prisma } = await import("@/config/prisma");
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: { hospitalRoles: { include: { hospital: true, role: true } } },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isSuperAdmin: user.isSuperAdmin },
      hospitals: user.hospitalRoles.map((hr) => ({ id: hr.hospitalId, name: hr.hospital.name, role: hr.role.name })),
      activeHospitalId: req.auth!.hospitalId ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// --- Self-service password reset ---
const forgotPasswordSchema = z.object({ email: z.string().email() });

authRouter.post("/forgot-password", authBruteForceLimiter, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    res.json(await requestPasswordReset(email));
  } catch (err) {
    next(err);
  }
});

const resetPasswordBodySchema = z.object({
  resetToken: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/reset-password", authBruteForceLimiter, async (req, res, next) => {
  try {
    const { resetToken, newPassword } = resetPasswordBodySchema.parse(req.body);
    res.json(await resetPassword(resetToken, newPassword));
  } catch (err) {
    next(err);
  }
});