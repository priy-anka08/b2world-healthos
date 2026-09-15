import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticator } from "otplib";
import { prisma } from "@/config/prisma";
import { env } from "@/config/env";
import { AppError } from "@/common/errors/error-handler";
import type { AuthTokenPayload } from "@/common/middleware/auth.middleware";

interface LoginResult {
  token?: string;
  mfaRequired?: boolean;
  userId?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isSuperAdmin: boolean;
  };
  hospitals?: { id: string; name: string; role: string }[];
}

function issueToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn as never });
}

export async function login(email: string, password: string, hospitalId?: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { hospitalRoles: { include: { hospital: true, role: true } } },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "Invalid credentials");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid credentials");
  }

  // Spec §37 hardening: MFA for privileged accounts. If enabled, the caller
  // gets back `mfaRequired: true` and must call /auth/mfa/verify-login with
  // the current TOTP code before a real token is issued — no session token
  // exists until that second step succeeds.
  if (user.mfaEnabled) {
    return { mfaRequired: true, userId: user.id };
  }

  return completeLogin(user.id, hospitalId);
}

export async function completeLogin(userId: string, hospitalId?: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { hospitalRoles: { include: { hospital: true, role: true } } },
  });
  if (!user) throw new AppError(401, "Invalid credentials");

  const hospitals = user.hospitalRoles.map((hr) => ({
    id: hr.hospitalId,
    name: hr.hospital.name,
    role: hr.role.name,
  }));

  const activeHospital =
    hospitalId != null ? hospitals.find((h) => h.id === hospitalId) : hospitals.length === 1 ? hospitals[0] : undefined;

  const payload: AuthTokenPayload = {
    userId: user.id,
    isSuperAdmin: user.isSuperAdmin,
    hospitalId: activeHospital?.id ?? null,
    organizationId: user.organizationId,
    role: activeHospital?.role ?? null,
  };

  const token = issueToken(payload);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
    },
    hospitals,
  };
}

export async function verifyMfaAndLogin(userId: string, token: string, hospitalId?: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaSecret) throw new AppError(401, "MFA not set up for this account");

  const valid = authenticator.check(token, user.mfaSecret);
  if (!valid) throw new AppError(401, "Invalid MFA code");

  return completeLogin(userId, hospitalId);
}

export async function setupMfa(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

  const otpauthUrl = authenticator.keyuri(user.email, "B2World HealthOS", secret);
  return { secret, otpauthUrl };
}

export async function enableMfa(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) throw new AppError(400, "Call /auth/mfa/setup first");

  const valid = authenticator.check(token, user.mfaSecret);
  if (!valid) throw new AppError(401, "Invalid MFA code");

  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  return { mfaEnabled: true };
}

export async function disableMfa(userId: string, token: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) throw new AppError(400, "MFA is not enabled");

  const valid = authenticator.check(token, user.mfaSecret);
  if (!valid) throw new AppError(401, "Invalid MFA code");

  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null } });
  return { mfaEnabled: false };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}