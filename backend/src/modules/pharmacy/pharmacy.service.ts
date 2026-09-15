import { prisma } from "@/config/prisma";

interface CreateItemInput {
  hospitalId: string;
  name: string;
  category: string;
  unit: string;
  reorderLevel?: number;
  currentStock?: number;
}

export async function listInventory(hospitalId: string) {
  return prisma.inventoryItem.findMany({
    where: { hospitalId },
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

// Simple stock adjustment (restock or dispense). A real implementation would
// also write an InventoryBatch row with expiry tracking — kept simple here
// since that's a Phase 3+ refinement, not core to proving the pattern.
export async function adjustStock(hospitalId: string, itemId: string, delta: number) {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, hospitalId } });
  if (!item) throw Object.assign(new Error("Item not found"), { statusCode: 404 });

  const newStock = item.currentStock + delta;
  if (newStock < 0) {
    throw Object.assign(new Error("Insufficient stock"), { statusCode: 409 });
  }

  return prisma.inventoryItem.update({
    where: { id: itemId },
    data: { currentStock: newStock },
  });
}