import { prisma } from "@/config/prisma";

interface CreateTestInput {
  hospitalId: string;
  name: string;
  code: string;
  price: number;
}

interface CreateOrderInput {
  hospitalId: string;
  patientId: string;
  labTestId: string;
  orderedByUserId: string;
}

export async function listLabTests(hospitalId: string) {
  return prisma.labTest.findMany({ where: { hospitalId }, orderBy: { name: "asc" } });
}

export async function createLabTest(input: CreateTestInput) {
  return prisma.labTest.create({ data: input });
}

export async function listLabOrders(hospitalId: string) {
  return prisma.labOrder.findMany({
    where: { hospitalId },
    include: {
      patient: { select: { firstName: true, lastName: true, patientCode: true } },
      labTest: { select: { name: true, code: true } },
      results: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createLabOrder(input: CreateOrderInput) {
  return prisma.labOrder.create({
    data: {
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      labTestId: input.labTestId,
      orderedByUserId: input.orderedByUserId,
      status: "ordered",
    },
  });
}

const STATUS_FLOW = ["ordered", "sample_collected", "processing", "resulted", "reviewed"];

export async function advanceOrderStatus(hospitalId: string, orderId: string) {
  const order = await prisma.labOrder.findFirst({ where: { id: orderId, hospitalId } });
  if (!order) throw Object.assign(new Error("Order not found"), { statusCode: 404 });

  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = STATUS_FLOW[Math.min(currentIdx + 1, STATUS_FLOW.length - 1)];

  return prisma.labOrder.update({ where: { id: orderId }, data: { status: nextStatus } });
}