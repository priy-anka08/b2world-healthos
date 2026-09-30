import bcrypt from "bcryptjs";
import crypto from "crypto";
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

  const hospitals = user.hospitalRoles.map((hr) => ({ id: hr.hospitalId, name: hr.hospital.name, role: hr.role.name }));

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
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isSuperAdmin: user.isSuperAdmin },
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

// --- Self-service password reset ---
const RESET_PURPOSE = "password_reset";

// A fingerprint of the CURRENT password hash, baked into the reset token.
// The moment the password changes (via this flow or an admin reset), the
// fingerprint stops matching — so the token dies automatically. No
// separate reset-token table, no cleanup job, and each token is
// effectively single-use.
function fingerprint(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always the same response shape whether or not the email exists —
  // never let this endpoint be used to enumerate registered emails.
  if (!user || user.status !== "ACTIVE") {
    return { message: "If that email exists, a reset link has been generated." };
  }

  const resetToken = jwt.sign(
    { userId: user.id, purpose: RESET_PURPOSE, pwFingerprint: fingerprint(user.passwordHash) },
    env.jwtSecret,
    { expiresIn: "15m" }
  );

  // MVP note: no email service is wired up yet (spec flags this as a
  // production-hosting concern, not a build blocker — §39/§41). In
  // production this token would be emailed as a link, never returned
  // in the API response.
  return {
    message: "If that email exists, a reset link has been generated.",
    devModeResetToken: resetToken,
    devModeNote: "No email service is configured — returning the token directly for local testing only. Never do this in production.",
  };
}

export async function resetPassword(resetToken: string, newPassword: string) {
  let payload: { userId: string; purpose: string; pwFingerprint: string };
  try {
    payload = jwt.verify(resetToken, env.jwtSecret) as never;
  } catch {
    throw new AppError(401, "Reset link is invalid or has expired");
  }
  if (payload.purpose !== RESET_PURPOSE) throw new AppError(401, "Invalid reset token");

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new AppError(401, "Reset link is invalid or has expired");

  if (fingerprint(user.passwordHash) !== payload.pwFingerprint) {
    throw new AppError(401, "Reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}