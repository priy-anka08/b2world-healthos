import { prisma } from "@/config/prisma";

interface CreateItemInput {
  hospitalId: string;
  name: string;
  category: string;
  unit: string;
  reorderLevel?: number;
  currentStock?: number;
}

export async function listInventory(hospitalId: string, category?: string) {
  return prisma.inventoryItem.findMany({
    where: { hospitalId, ...(category ? { category } : {}) },
    include: { batches: { orderBy: { expiryDate: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function createInventoryItem(input: CreateItemInput) {
  return prisma.inventoryItem.create({
    data: {
      hospitalId: input.hospitalId,
      name: input.name,
      category: input.category,
      unit: input.unit,
      reorderLevel: input.reorderLevel ?? 10,
      currentStock: input.currentStock ?? 0,
    },
  });
}

export async function adjustStock(hospitalId: string, itemId: string, delta: number) {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, hospitalId } });
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });

  const newStock = item.currentStock + delta;
  if (newStock < 0) {
    throw Object.assign(new Error("Insufficient stock"), { statusCode: 409 });
  }

  return prisma.inventoryItem.update({ where: { id: itemId }, data: { currentStock: newStock } });
}

export async function lowStockItems(hospitalId: string) {
  const items = await prisma.inventoryItem.findMany({ where: { hospitalId } });
  return items.filter((i) => i.currentStock <= i.reorderLevel);
}

interface AddBatchInput {
  hospitalId: string;
  itemId: string;
  batchNumber: string;
  quantity: number;
  expiryDate: Date;
  supplierId?: string;
}

// Adding a batch also bumps the parent item's currentStock — batches are how
// stock physically arrives. currentStock stays the single source of truth
// that pharmacy/ai-copilot/ai-predictions already read from elsewhere.
export async function addBatch(input: AddBatchInput) {
  const item = await prisma.inventoryItem.findFirst({ where: { id: input.itemId, hospitalId: input.hospitalId } });
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, hospitalId: input.hospitalId },
    });
    if (!supplier) throw Object.assign(new Error("Supplier not found"), { statusCode: 404 });
  }

  const [batch] = await prisma.$transaction([
    prisma.inventoryBatch.create({
      data: {
        itemId: input.itemId,
        batchNumber: input.batchNumber,
        quantity: input.quantity,
        expiryDate: input.expiryDate,
        supplierId: input.supplierId,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: input.itemId },
      data: { currentStock: { increment: input.quantity } },
    }),
  ]);

  return batch;
}

export async function listBatches(hospitalId: string, itemId: string) {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, hospitalId } });
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });
  return prisma.inventoryBatch.findMany({ where: { itemId }, orderBy: { expiryDate: "asc" } });
}

// Spec §19-style expiry alert: batches expiring within `days`, tenant-scoped
// through the item relation (InventoryBatch itself has no hospitalId column).
export async function expiringBatches(hospitalId: string, days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  return prisma.inventoryBatch.findMany({
    where: { expiryDate: { lte: cutoff }, item: { hospitalId } },
    include: {
      item: { select: { name: true, unit: true } },
      supplier: { select: { name: true } },
    },
    orderBy: { expiryDate: "asc" },
  });
}