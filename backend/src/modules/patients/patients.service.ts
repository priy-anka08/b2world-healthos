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

export async function listPatients(hospitalId: string, search?: string, departmentScope?: string) {
  return prisma.patient.findMany({
    where: {
      hospitalId,
      duplicateOfId: null,
      ...(departmentScope ? { appointments: { some: { departmentId: departmentScope } } } : {}),
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

// --- Update patient details (spec §6) ---
interface UpdatePatientInput {
  firstName?: string;
  lastName?: string;
  dob?: Date;
  gender?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  allergies?: string[];
}

export async function updatePatient(hospitalId: string, patientId: string, updates: UpdatePatientInput) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  return prisma.patient.update({ where: { id: patientId }, data: updates });
}

// --- Registration receipt (spec §6) ---
export async function getRegistrationReceipt(hospitalId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId },
    include: { hospital: { select: { name: true, address: true, phone: true } } },
  });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  return {
    receiptNumber: `REG-${patient.patientCode}`,
    issuedAt: new Date().toISOString(),
    hospital: patient.hospital,
    patient: {
      patientCode: patient.patientCode,
      name: `${patient.firstName} ${patient.lastName}`,
      dob: patient.dob,
      gender: patient.gender,
      contactPhone: patient.contactPhone,
      contactEmail: patient.contactEmail,
      emergencyContact: patient.emergencyContact,
      bloodGroup: patient.bloodGroup,
      registeredOn: patient.createdAt,
    },
  };
}

// --- Document upload (spec §6, non-OCR) ---
// No file-storage backend in this MVP (same limitation the OCR pipeline
// has) — fileUrl is a reference the staff member supplies (a link, or a
// filename if it's kept elsewhere). Swap for real storage (S3/Cloudinary)
// without changing this function's shape later.
export async function uploadPatientDocument(hospitalId: string, patientId: string, uploadedById: string, type: string, fileUrl: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  return prisma.patientDocument.create({ data: { patientId, type, fileUrl, uploadedById } });
}

export async function listPatientDocuments(hospitalId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  return prisma.patientDocument.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } });
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

// --- Duplicate merge (spec §5 — human-confirmed only, never automatic) ---
export async function mergePatients(hospitalId: string, primaryId: string, duplicateId: string) {
  if (primaryId === duplicateId) throw Object.assign(new Error("Cannot merge a patient into itself"), { statusCode: 400 });

  const [primary, duplicate] = await Promise.all([
    prisma.patient.findFirst({ where: { id: primaryId, hospitalId } }),
    prisma.patient.findFirst({ where: { id: duplicateId, hospitalId } }),
  ]);
  if (!primary || !duplicate) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  if (duplicate.duplicateOfId) throw Object.assign(new Error("That record was already merged"), { statusCode: 409 });

  // Every record pointing at the duplicate gets re-pointed at the primary,
  // then the duplicate row itself is kept (never deleted) but flagged via
  // duplicateOfId — preserves a full audit trail of the merge.
  await prisma.$transaction([
    prisma.appointment.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.encounter.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.invoice.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.patientDocument.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.labOrder.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.patientConsent.updateMany({ where: { patientId: duplicateId }, data: { patientId: primaryId } }),
    prisma.patient.update({ where: { id: duplicateId }, data: { duplicateOfId: primaryId } }),
  ]);

  return prisma.patient.findUnique({ where: { id: primaryId } });
}