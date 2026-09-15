import { prisma } from "@/config/prisma";

interface CreateSupplierInput {
  hospitalId: string;
  name: string;
  contact?: string;
  email?: string;
}

export async function listSuppliers(hospitalId: string) {
  return prisma.supplier.findMany({ where: { hospitalId }, orderBy: { name: "asc" } });
}

export async function createSupplier(input: CreateSupplierInput) {
  return prisma.supplier.create({ data: input });
}

interface CreatePurchaseOrderInput {
  hospitalId: string;
  supplierId: string;
  totalAmount: number;
}

export async function listPurchaseOrders(hospitalId: string) {
  return prisma.purchaseOrder.findMany({
    where: { hospitalId },
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput) {
  return prisma.purchaseOrder.create({
    data: {
      hospitalId: input.hospitalId,
      supplierId: input.supplierId,
      totalAmount: input.totalAmount,
      status: "draft",
    },
  });
}

const PO_STATUSES = ["draft", "sent", "received", "cancelled"];

export async function setPurchaseOrderStatus(hospitalId: string, poId: string, status: string) {
  if (!PO_STATUSES.includes(status)) {
    throw Object.assign(new Error("Invalid purchase order status"), { statusCode: 400 });
  }
  const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, hospitalId } });
  if (!po) throw Object.assign(new Error("Purchase order not found"), { statusCode: 404 });

  return prisma.purchaseOrder.update({ where: { id: poId }, data: { status } });
}