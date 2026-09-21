import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({
  prisma: {
    inventoryItem: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    inventoryBatch: { create: vi.fn(), findMany: vi.fn() },
    supplier: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/config/prisma";
import { adjustStock, lowStockItems } from "./inventory.service";

describe("inventory.service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("adjustStock", () => {
    it("throws 404 when the item doesn't belong to this hospital", async () => {
      (prisma.inventoryItem.findFirst as any).mockResolvedValue(null);
      await expect(adjustStock("hosp-1", "item-1", 5)).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects a negative-stock adjustment", async () => {
      (prisma.inventoryItem.findFirst as any).mockResolvedValue({ id: "item-1", currentStock: 3, hospitalId: "hosp-1" });
      await expect(adjustStock("hosp-1", "item-1", -10)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("applies a positive delta correctly", async () => {
      (prisma.inventoryItem.findFirst as any).mockResolvedValue({ id: "item-1", currentStock: 10, hospitalId: "hosp-1" });
      (prisma.inventoryItem.update as any).mockResolvedValue({ id: "item-1", currentStock: 15 });
      const result = await adjustStock("hosp-1", "item-1", 5);
      expect(prisma.inventoryItem.update).toHaveBeenCalledWith({ where: { id: "item-1" }, data: { currentStock: 15 } });
      expect(result.currentStock).toBe(15);
    });
  });

  describe("lowStockItems", () => {
    it("returns only items at or below their reorder level", async () => {
      (prisma.inventoryItem.findMany as any).mockResolvedValue([
        { id: "a", currentStock: 5, reorderLevel: 10 },
        { id: "b", currentStock: 20, reorderLevel: 10 },
        { id: "c", currentStock: 10, reorderLevel: 10 },
      ]);
      const result = await lowStockItems("hosp-1");
      expect(result.map((i: any) => i.id)).toEqual(["a", "c"]);
    });
  });
});