import { prisma } from "@/config/prisma";

interface NoteContent {
  chiefComplaint?: string;
  history?: string;
  observations?: string;
  assessment?: string;
  plan?: string;
}

// Notes are scoped to an encounter, which already carries hospitalId — so
// we verify the encounter belongs to this hospital before writing, rather
// than filtering ClinicalNote directly (it has no hospitalId column of its
// own by design, since it's always reached through its parent encounter).
async function assertEncounterInHospital(hospitalId: string, encounterId: string) {
  const encounter = await prisma.encounter.findFirst({ where: { id: encounterId, hospitalId } });
  if (!encounter) throw Object.assign(new Error("Encounter not found"), { statusCode: 404 });
  return encounter;
}

export async function createClinicalNote(
  hospitalId: string,
  encounterId: string,
  authorUserId: string,
  content: NoteContent
) {
  await assertEncounterInHospital(hospitalId, encounterId);
  return prisma.clinicalNote.create({
    data: {
      encounterId,
      authorUserId,
      content: content as never,
      // Spec §10: AI-drafted notes require human approval before becoming
      // official. Notes entered directly by a clinician here are
      // self-authored, so we mark them approved by their own author at
      // creation time — there's no separate draft step for manual entry.
      approvedByUserId: authorUserId,
      approvedAt: new Date(),
    },
  });
}

export async function listClinicalNotes(hospitalId: string, encounterId: string) {
  await assertEncounterInHospital(hospitalId, encounterId);
  return prisma.clinicalNote.findMany({
    where: { encounterId },
    orderBy: { createdAt: "desc" },
  });
}