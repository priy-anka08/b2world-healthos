import axios from "axios";
import { env } from "@/config/env";
import { prisma } from "@/config/prisma";

export async function summarizePatientHistory(hospitalId: string, userId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, hospitalId },
    include: {
      encounters: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { clinicalNotes: true, practitioner: { include: { user: true } } },
      },
    },
  });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  const historyText = patient.encounters
    .map((e) => {
      const notes = e.clinicalNotes
        .map((n) => {
          const c = n.content as Record<string, string>;
          return [c.chiefComplaint, c.history, c.observations, c.assessment, c.plan].filter(Boolean).join(" | ");
        })
        .join("; ");
      return `Visit on ${e.startedAt.toISOString().slice(0, 10)} with Dr. ${e.practitioner.user.lastName}: ${notes || "no notes recorded"}`;
    })
    .join("\n");

  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId,
      userId,
      feature: "clinical_summary",
      inputSummary: `Summary for patient ${patientId}`,
      dataScope: { patientId, encounterCount: patient.encounters.length },
    },
  });

  let summary: string;
  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/summarization/query`, {
      patientHistoryText: historyText,
    });
    summary = data.summary;
  } catch {
    summary = "AI summarization service is currently unavailable. Please review the encounter history below directly.";
  }

  await prisma.aIOutput.create({
    data: {
      aiRequestId: aiRequest.id,
      output: { summary } as never,
      requiresApproval: false, // read-only aid, nothing gets written to the record
    },
  });

  return {
    summary,
    basedOnEncounters: patient.encounters.length,
    sourceEncounterIds: patient.encounters.map((e) => e.id),
    disclaimer: "AI-generated summary — verify against the full record for anything clinically significant.",
  };
}