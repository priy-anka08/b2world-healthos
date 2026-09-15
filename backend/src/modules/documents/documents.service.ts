import { prisma } from "@/config/prisma";

interface CreateDocumentInput {
  hospitalId: string;
  uploadedByUserId: string;
  title: string;
  category: string;
  content: string; // pasted text for now — real file upload + OCR is a
  // later phase; stored in the `fileUrl` column as plain text so the
  // schema doesn't need to change when real file storage is added.
}

export async function listDocuments(hospitalId: string) {
  return prisma.document.findMany({
    where: { hospitalId },
    select: { id: true, title: true, category: true, uploadedByUserId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDocument(hospitalId: string, documentId: string) {
  return prisma.document.findFirst({ where: { id: documentId, hospitalId } });
}

export async function createDocument(input: CreateDocumentInput) {
  return prisma.document.create({
    data: {
      hospitalId: input.hospitalId,
      uploadedByUserId: input.uploadedByUserId,
      title: input.title,
      category: input.category,
      fileUrl: input.content,
    },
  });
}