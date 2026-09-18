import axios from "axios";
import { env } from "@/config/env";
import { prisma } from "@/config/prisma";

const DOCUMENT_TYPES = ["prescription", "lab_report", "discharge_summary", "referral"] as const;
type DocumentType = (typeof DOCUMENT_TYPES)[number];

interface ExtractInput {
  hospitalId: string;
  userId: string;
  patientId: string;
  documentType?: DocumentType;
  imageBase64: string; // data URI or raw base64 of the scanned document/photo
}

// Spec §12/§21 pipeline: Document -> OCR -> classification -> extraction ->
// structured data -> HUMAN VERIFICATION -> patient record. This function
// stops right after "structured data" — it writes a draft only. Only
// verifyExtraction() below (called by a human, from a button click) can
// flip a document to "verified".
export async function extractDocument(input: ExtractInput) {
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, hospitalId: input.hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });

  const patientDoc = await prisma.patientDocument.create({
    data: {
      patientId: input.patientId,
      type: input.documentType ?? "prescription",
      fileUrl: "inline-upload", // no file storage in this MVP — only the OCR output is persisted
      ocrStatus: "processing",
      uploadedById: input.userId,
    },
  });

  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId: input.hospitalId,
      userId: input.userId,
      feature: "ocr",
      inputSummary: `OCR extraction for patient ${input.patientId}, document ${patientDoc.id}`,
      dataScope: { patientId: input.patientId, patientDocumentId: patientDoc.id },
    },
  });

  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/ocr/extract`, {
      image_base64: input.imageBase64,
      document_type_hint: input.documentType,
    });

    const aiOutput = await prisma.aIOutput.create({
      data: { aiRequestId: aiRequest.id, output: data as never, requiresApproval: true },
    });

    await prisma.patientDocument.update({
      where: { id: patientDoc.id },
      data: {
        type: data.documentType ?? patientDoc.type,
        ocrStatus: "processed",
        extractedData: data as never,
      },
    });

    return {
      patientDocumentId: patientDoc.id,
      aiOutputId: aiOutput.id,
      documentType: data.documentType,
      rawText: data.rawText,
      extractedFields: data.extractedFields,
      confidence: data.confidence,
      requiresApproval: true,
      disclaimer: "AI-extracted draft — a human must verify this before it becomes part of the patient record.",
    };
  } catch (err) {
    await prisma.patientDocument.update({ where: { id: patientDoc.id }, data: { ocrStatus: "failed" } });
    throw Object.assign(
      new Error("OCR extraction failed — the AI service may be unavailable, or PaddleOCR isn't ready yet."),
      { statusCode: 502 }
    );
  }
}

export async function listPendingVerification(hospitalId: string) {
  return prisma.patientDocument.findMany({
    where: { ocrStatus: "processed", patient: { hospitalId } },
    include: { patient: { select: { firstName: true, lastName: true, patientCode: true } } },
    orderBy: { createdAt: "desc" },
  });
}

interface VerifyInput {
  hospitalId: string;
  userId: string;
  patientDocumentId: string;
  correctedData?: Record<string, unknown>;
}

// The only path that turns an AI draft into something trustworthy enough
// to sit in the patient's record. Never called automatically.
export async function verifyExtraction(input: VerifyInput) {
  const doc = await prisma.patientDocument.findFirst({
    where: { id: input.patientDocumentId, patient: { hospitalId: input.hospitalId } },
  });
  if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });
  if (doc.ocrStatus !== "processed") {
    throw Object.assign(new Error(`Cannot verify a document with status "${doc.ocrStatus}"`), { statusCode: 409 });
  }

  const finalData = input.correctedData ?? (doc.extractedData as Record<string, unknown> | null) ?? {};

  const updated = await prisma.patientDocument.update({
    where: { id: doc.id },
    data: { ocrStatus: "verified", extractedData: finalData as never },
  });

  const aiRequest = await prisma.aIRequest.findFirst({
    where: { feature: "ocr", dataScope: { path: ["patientDocumentId"], equals: doc.id } },
    orderBy: { createdAt: "desc" },
    include: { outputs: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (aiRequest?.outputs[0]) {
    await prisma.aIOutput.update({
      where: { id: aiRequest.outputs[0].id },
      data: { approvedByUserId: input.userId, approvedAt: new Date() },
    });
  }

  return updated;
}