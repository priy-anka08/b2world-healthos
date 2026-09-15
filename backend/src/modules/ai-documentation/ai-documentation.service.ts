import axios from "axios";
import { env } from "@/config/env";
import { prisma } from "@/config/prisma";

interface DraftInput {
  hospitalId: string;
  userId: string;
  encounterId: string;
  rawNotes: string;
}

// Spec §38 governance: every AI call logs an AIRequest (who/when/what data
// scope) and, where content is generated, an AIOutput row that carries
// requiresApproval. This function never writes to clinical_notes — the
// existing, unmodified clinical-notes module is the only path to an
// official note.
export async function draftClinicalNote(input: DraftInput) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: input.encounterId, hospitalId: input.hospitalId },
  });
  if (!encounter) throw Object.assign(new Error("Encounter not found"), { statusCode: 404 });

  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId: input.hospitalId,
      userId: input.userId,
      feature: "documentation_assistant",
      inputSummary: `Draft note for encounter ${input.encounterId}`,
      dataScope: { encounterId: input.encounterId },
    },
  });

  let draftJson: unknown = null;
  let rawText = "";
  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/documentation/query`, {
      rawNotes: input.rawNotes,
    });
    rawText = data.draft;
    draftJson = JSON.parse(rawText);
  } catch {
    // If the model didn't return clean JSON, fall back to handing back the
    // raw text so the doctor can still see and use it — better than a
    // hard failure on a best-effort drafting aid.
    draftJson = { plan: rawText || "AI service unavailable — please write the note manually." };
  }

  const aiOutput = await prisma.aIOutput.create({
    data: {
      aiRequestId: aiRequest.id,
      output: draftJson as never,
      requiresApproval: true,
    },
  });

  return {
    aiOutputId: aiOutput.id,
    draft: draftJson,
    requiresApproval: true,
    disclaimer: "AI-generated draft — review and edit before saving as an official note.",
  };
}