import { prisma } from "@/config/prisma";
import { hashPassword } from "@/modules/auth/auth.service";

interface CreateStaffInput {
  hospitalId: string;
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword: string;
  jobTitle?: string;
  departmentId?: string;
  role: "NURSE" | "RECEPTIONIST" | "PHARMACIST" | "LAB_TECHNICIAN" | "ACCOUNTANT";
}

export async function listStaff(hospitalId: string) {
  return prisma.staff.findMany({
    where: { hospitalId },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, status: true } },
      department: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });
}

export async function createStaff(input: CreateStaffInput) {
  const role = await prisma.role.findUnique({ where: { name: input.role } });
  if (!role) throw Object.assign(new Error(`Role ${input.role} not seeded`), { statusCode: 500 });

  const passwordHash = await hashPassword(input.temporaryPassword);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: { email: input.email, firstName: input.firstName, lastName: input.lastName, passwordHash },
  });

  await prisma.userHospital.upsert({
    where: { userId_hospitalId_roleId: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id } },
    update: {},
    create: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id },
  });

  return prisma.staff.upsert({
    where: { userId: user.id },
    update: { jobTitle: input.jobTitle, departmentId: input.departmentId },
    create: {
      hospitalId: input.hospitalId,
      userId: user.id,
      jobTitle: input.jobTitle,
      departmentId: input.departmentId,
    },
    include: { user: true, department: true },
  });
}