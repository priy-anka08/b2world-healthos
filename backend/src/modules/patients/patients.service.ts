import { prisma } from "@/config/prisma";

interface CreatePatientInput {
  hospitalId: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  dob?: Date;
  gender?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  allergies?: string[];
}

interface PossibleDuplicate {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  dob: Date | null;
  matchReason: string[];
}

/**
 * Spec §5: "If a new patient appears similar to an existing patient, flag
 * 'Possible duplicate patient record.' A human administrator must confirm
 * any merge." — this NEVER auto-merges. It only returns candidates.
 */
export async function findPossibleDuplicates(
  hospitalId: string,
  input: Pick<CreatePatientInput, "firstName" | "lastName" | "dob" | "contactPhone">
): Promise<PossibleDuplicate[]> {
  const candidates = await prisma.patient.findMany({
    where: {
      hospitalId,
      OR: [
        { firstName: { equals: input.firstName, mode: "insensitive" }, lastName: { equals: input.lastName, mode: "insensitive" } },
        input.contactPhone ? { contactPhone: input.contactPhone } : undefined,
      ].filter(Boolean) as never,
    },
    take: 10,
  });

  return candidates.map((c) => {
    const reasons: string[] = [];
    if (c.firstName.toLowerCase() === input.firstName.toLowerCase() && c.lastName.toLowerCase() === input.lastName.toLowerCase()) {
      reasons.push("name_match");
    }
    if (input.dob && c.dob && c.dob.toDateString() === input.dob.toDateString()) {
      reasons.push("dob_match");
    }
    if (input.contactPhone && c.contactPhone === input.contactPhone) {
      reasons.push("phone_match");
    }
    return {
      id: c.id,
      patientCode: c.patientCode,
      firstName: c.firstName,
      lastName: c.lastName,
      dob: c.dob,
      matchReason: reasons,
    };
  });
}

export async function createPatient(input: CreatePatientInput) {
  return prisma.patient.create({ data: input });
}

export async function listPatients(hospitalId: string, search?: string) {
  return prisma.patient.findMany({
    where: {
      hospitalId,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { patientCode: { contains: search, mode: "insensitive" } },
              { contactPhone: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// Always scope by hospitalId even on a get-by-id — this is what stops
// Hospital A from reading Hospital B's patient by guessing/enumerating ids.
export async function getPatientById(hospitalId: string, id: string) {
  return prisma.patient.findFirst({
    where: { id, hospitalId },
    include: {
      documents: true,
      appointments: { orderBy: { scheduledAt: "desc" }, take: 20 },
      encounters: { orderBy: { startedAt: "desc" }, take: 20 },
      invoices: true,
    },
  });
}
