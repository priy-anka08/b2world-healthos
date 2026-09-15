import { prisma } from "@/config/prisma";

interface CreatePrescriptionInput {
  encounterId: string;
  dosage: string; // free-text: "Paracetamol 500mg" style — matches the
  // simple-EMR pattern where a full medicine catalog isn't in scope yet
  frequency: string;
  durationDays?: number;
  notes?: string;
}

async function assertEncounterInHospital(hospitalId: string, encounterId: string) {
  const encounter = await prisma.encounter.findFirst({ where: { id: encounterId, hospitalId } });
  if (!encounter) throw Object.assign(new Error("Encounter not found"), { statusCode: 404 });
  return encounter;
}

export async function createPrescription(hospitalId: string, input: CreatePrescriptionInput) {
  await assertEncounterInHospital(hospitalId, input.encounterId);
  return prisma.medicationRequest.create({
    data: {
      encounterId: input.encounterId,
      dosage: input.dosage,
      frequency: input.frequency,
      durationDays: input.durationDays,
      notes: input.notes,
    },
  });
}

export async function listPrescriptions(hospitalId: string, encounterId: string) {
  await assertEncounterInHospital(hospitalId, encounterId);
  return prisma.medicationRequest.findMany({
    where: { encounterId },
    orderBy: { createdAt: "desc" },
  });
}