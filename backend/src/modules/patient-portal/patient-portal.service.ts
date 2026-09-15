import { prisma } from "@/config/prisma";
import { hashPassword } from "@/modules/auth/auth.service";

interface InvitePortalInput {
  hospitalId: string;
  patientId: string;
  email: string;
  temporaryPassword: string;
}

// Links an existing Patient record to a login-capable User account with
// the PATIENT role. A patient can only ever be linked to one portal
// account (Patient.userId is unique) — calling this twice on an already-
// linked patient is rejected rather than silently creating a second link.
export async function invitePortalAccess(input: InvitePortalInput) {
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, hospitalId: input.hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  if (patient.userId) throw Object.assign(new Error("This patient already has portal access"), { statusCode: 409 });

  const role = await prisma.role.findUnique({ where: { name: "PATIENT" } });
  if (!role) throw Object.assign(new Error("PATIENT role not seeded"), { statusCode: 500 });

  const passwordHash = await hashPassword(input.temporaryPassword);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      firstName: patient.firstName,
      lastName: patient.lastName,
      passwordHash,
    },
  });

  await prisma.userHospital.upsert({
    where: { userId_hospitalId_roleId: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id } },
    update: {},
    create: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id },
  });

  await prisma.patient.update({ where: { id: input.patientId }, data: { userId: user.id } });

  return { userId: user.id, email: user.email };
}

// The portal's own "my data" view — deliberately narrow and read-only.
// Scoped by the calling user's own id, never a client-supplied patient id,
// so a patient can never fetch anyone else's record through this endpoint.
export async function getMyPortalData(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 20,
        include: { practitioner: { include: { user: true } } },
      },
      encounters: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { medicationRequests: true, clinicalNotes: { select: { content: true, createdAt: true } } },
      },
      invoices: { orderBy: { createdAt: "desc" }, take: 10, include: { payments: true } },
    },
  });
  if (!patient) throw Object.assign(new Error("No patient record linked to this account"), { statusCode: 404 });

  return patient;
}