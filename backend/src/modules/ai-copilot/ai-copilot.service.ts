import axios from "axios";
import { env } from "@/config/env";
import { prisma } from "@/config/prisma";

// Gathers a small, real, hospital-scoped data snapshot for the copilot to
// reason over. Deliberately narrow (a handful of counts) — expand this as
// more questions come up, but always keep it real data pulled with the
// same scoping every other module uses, never anything fabricated.
async function gatherContext(hospitalId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [patientCount, appointmentsToday, lowStockItems, pendingLabOrders, unpaidInvoices, availableBeds] =
    await Promise.all([
      prisma.patient.count({ where: { hospitalId } }),
      prisma.appointment.count({ where: { hospitalId, scheduledAt: { gte: today, lt: tomorrow } } }),
      prisma.inventoryItem.findMany({
        where: { hospitalId },
        select: { name: true, currentStock: true, reorderLevel: true },
      }).then((items) => items.filter((i) => i.currentStock <= i.reorderLevel)),
      prisma.labOrder.count({ where: { hospitalId, status: { not: "reviewed" } } }),
      prisma.invoice.count({ where: { hospitalId, status: { not: "paid" } } }),
      prisma.bed.count({ where: { hospitalId, status: "available" } }),
    ]);

  return {
    totalPatients: patientCount,
    appointmentsToday,
    lowStockItems: lowStockItems.map((i) => `${i.name} (${i.currentStock}/${i.reorderLevel})`),
    pendingLabOrders,
    unpaidInvoices,
    availableBeds,
  };
}

export async function askCopilot(hospitalId: string, userId: string, question: string) {
  const contextData = await gatherContext(hospitalId);

  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId,
      userId,
      feature: "ai_copilot",
      inputSummary: question.slice(0, 200),
      dataScope: contextData as never,
    },
  });

  let answer: string;
  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/copilot/query`, { question, contextData });
    answer = data.answer;
  } catch {
    answer = "AI copilot service is currently unavailable. Please check the relevant dashboard directly.";
  }

  await prisma.aIOutput.create({
    data: { aiRequestId: aiRequest.id, output: { answer } as never, requiresApproval: false },
  });

  return { answer, dataUsed: contextData };
}