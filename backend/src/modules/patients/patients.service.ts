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
    return { id: c.id, patientCode: c.patientCode, firstName: c.firstName, lastName: c.lastName, dob: c.dob, matchReason: reasons };
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

// --- Consent management (spec §37) ---
export async function setConsent(hospitalId: string, patientId: string, type: string, granted: boolean) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  return prisma.patientConsent.create({ data: { patientId, type, granted, revokedAt: granted ? null : new Date() } });
}

export async function listConsents(hospitalId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  return prisma.patientConsent.findMany({ where: { patientId }, orderBy: { grantedAt: "desc" } });
}

// --- Data export controls (spec §37) ---
// A structured export of everything this hospital holds about one patient —
// read-only, and every query is scoped to this patientId, so it can never
// leak another patient's data even indirectly.
export async function exportPatientData(hospitalId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId },
    include: {
      documents: true,
      appointments: true,
      encounters: {
        include: { clinicalNotes: true, medicationRequests: true, observations: true, diagnosticReports: true },
      },
      invoices: { include: { payments: true, refunds: true } },
    },
  });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  const consents = await prisma.patientConsent.findMany({ where: { patientId } });

  return { exportedAt: new Date().toISOString(), patient, consents };
}