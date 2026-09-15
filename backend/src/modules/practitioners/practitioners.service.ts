import { prisma } from "@/config/prisma";
import { hashPassword } from "@/modules/auth/auth.service";

interface CreatePractitionerInput {
  hospitalId: string;
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  specialization?: string;
  licenseNumber?: string;
}

export async function listPractitioners(hospitalId: string) {
  return prisma.practitioner.findMany({
    where: { hospitalId },
    include: { user: { select: { firstName: true, lastName: true, email: true, status: true } } },
    orderBy: { id: "asc" },
  });
}

export async function createPractitioner(input: CreatePractitionerInput) {
  const role = await prisma.role.findUnique({ where: { name: "DOCTOR" } });
  if (!role) throw Object.assign(new Error("DOCTOR role not seeded"), { statusCode: 500 });

  const passwordHash = await hashPassword(input.temporaryPassword);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    },
  });

  await prisma.userHospital.upsert({
    where: { userId_hospitalId_roleId: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id } },
    update: {},
    create: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id },
  });

  return prisma.practitioner.upsert({
    where: { userId: user.id },
    update: { specialization: input.specialization, licenseNumber: input.licenseNumber },
    create: {
      hospitalId: input.hospitalId,
      userId: user.id,
      specialization: input.specialization,
      licenseNumber: input.licenseNumber,
    },
    include: { user: true },
  });
}