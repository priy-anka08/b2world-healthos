import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/config/prisma", () => ({
  prisma: {
    patient: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/config/prisma";
import { updatePatient } from "./patients.service";

describe("updatePatient", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 404 when the patient doesn't belong to this hospital", async () => {
    (prisma.patient.findFirst as any).mockResolvedValue(null);
    await expect(updatePatient("hosp-1", "pat-1", { firstName: "New" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("updates the patient when found", async () => {
    (prisma.patient.findFirst as any).mockResolvedValue({ id: "pat-1", hospitalId: "hosp-1" });
    (prisma.patient.update as any).mockResolvedValue({ id: "pat-1", firstName: "New" });
    const result = await updatePatient("hosp-1", "pat-1", { firstName: "New" });
    expect(prisma.patient.update).toHaveBeenCalledWith({ where: { id: "pat-1" }, data: { firstName: "New" } });
    expect(result.firstName).toBe("New");
  });
});