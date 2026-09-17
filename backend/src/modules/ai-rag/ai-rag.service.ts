import { prisma } from "@/config/prisma";
import { env } from "@/config/env";

interface IngestDocumentInput {
  hospitalId: string;
  documentId: string;
  title: string;
  fileContent: string; // extracted text content
}

interface RAGQueryInput {
  hospitalId: string;
  userId: string;
  question: string;
  topK?: number;
}

/**
 * Chunk a document into ~500 char pieces with overlap.
 * Simple approach for MVP — can be upgraded to semantic chunking later.
 */
function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.trim().length > 20);
}

/**
 * Get embeddings from the AI service (which calls Ollama internally).
 */
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const resp = await fetch(`${env.aiServiceUrl}/rag/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts }),
  });
  if (!resp.ok) throw new Error(`AI service embedding failed: ${resp.status}`);
  const data = await resp.json();
  return data.embeddings;
}

/**
 * Ingest a document: chunk → embed → store in document_chunks with vectors.
 * Uses raw SQL for pgvector operations since Prisma doesn't natively support vector types.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<{ chunksCreated: number }> {
  const { hospitalId, documentId, title, fileContent } = input;

  // Verify document belongs to this hospital
  const doc = await prisma.document.findFirst({
    where: { id: documentId, hospitalId },
  });
  if (!doc) throw Object.assign(new Error("Document not found"), { statusCode: 404 });

  const textChunks = chunkText(fileContent);
  if (textChunks.length === 0) {
    return { chunksCreated: 0 };
  }

  // Get embeddings from AI service
  const embeddings = await getEmbeddings(textChunks);

  // Delete old chunks for this document (re-ingest scenario)
  await prisma.documentChunk.deleteMany({ where: { documentId } });

  // Insert chunks with vectors using raw SQL (pgvector)
  for (let i = 0; i < textChunks.length; i++) {
    const vectorStr = `[${embeddings[i].join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO document_chunks (id, "documentId", content, embedding)
       VALUES (gen_random_uuid(), $1, $2, $3::vector)`,
      documentId,
      textChunks[i],
      vectorStr
    );
  }

  return { chunksCreated: textChunks.length };
}

/**
 * Query the RAG system:
 * 1. Embed the question
 * 2. pgvector similarity search (tenant-scoped!)
 * 3. Send retrieved chunks to AI service for answer generation
 */
export async function queryRAG(input: RAGQueryInput) {
  const { hospitalId, userId, question, topK = 5 } = input;

  // Step 1: Embed the question
  const [questionEmbedding] = await getEmbeddings([question]);
  const vectorStr = `[${questionEmbedding.join(",")}]`;

  // Step 2: Tenant-scoped pgvector similarity search
  const chunks: { id: string; content: string; document_title: string; similarity: number }[] =
    await prisma.$queryRawUnsafe(
      `SELECT dc.id, dc.content, d.title as document_title,
              1 - (dc.embedding <=> $1::vector) as similarity
       FROM document_chunks dc
       JOIN documents d ON d.id = dc."documentId"
       WHERE d."hospitalId" = $2
       ORDER BY dc.embedding <=> $1::vector
       LIMIT $3`,
      vectorStr,
      hospitalId,
      topK
    );

  // Step 3: Log AI request (spec §38 — governance)
  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId,
      userId,
      feature: "rag_assistant",
      inputSummary: question.slice(0, 200),
      dataScope: { chunksRetrieved: chunks.length },
    },
  });

  // Step 4: Call AI service for answer generation
  const resp = await fetch(`${env.aiServiceUrl}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      hospital_id: hospitalId,
      user_id: userId,
      chunks: chunks.map((c) => ({
        id: c.id,
        content: c.content,
        document_title: c.document_title,
      })),
      top_k: topK,
    }),
  });

  if (!resp.ok) throw new Error(`AI RAG query failed: ${resp.status}`);
  const result = await resp.json();

  // Step 5: Log AI output
  await prisma.aIOutput.create({
    data: {
      aiRequestId: aiRequest.id,
      output: result,
      requiresApproval: false, // RAG answers are informational, not clinical
    },
  });

  return {
    answer: result.answer,
    sources: result.sources,
    aiRequestId: aiRequest.id,
  };
}

/**
 * List all ingested documents for a hospital (with chunk count).
 */
export async function listIngestedDocuments(hospitalId: string) {
  return prisma.document.findMany({
    where: { hospitalId, category: { in: ["sop", "policy", "guideline", "equipment_manual", "department_doc"] } },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" },
  });
}
