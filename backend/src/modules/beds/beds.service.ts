import { prisma } from "@/config/prisma";

export async function listWards(hospitalId: string) {
  return prisma.ward.findMany({
    where: { hospitalId },
    include: { rooms: { include: { beds: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createWard(hospitalId: string, name: string) {
  return prisma.ward.create({ data: { hospitalId, name } });
}

export async function createRoom(hospitalId: string, wardId: string, number: string) {
  return prisma.room.create({ data: { hospitalId, wardId, number } });
}

export async function createBed(hospitalId: string, roomId: string, code: string) {
  return prisma.bed.create({ data: { hospitalId, roomId, code, status: "available" } });
}

const BED_STATUSES = ["available", "occupied", "maintenance", "reserved"];

export async function setBedStatus(hospitalId: string, bedId: string, status: string) {
  if (!BED_STATUSES.includes(status)) {
    throw Object.assign(new Error("Invalid bed status"), { statusCode: 400 });
  }
  const bed = await prisma.bed.findFirst({ where: { id: bedId, hospitalId } });
  if (!bed) throw Object.assign(new Error("Bed not found"), { statusCode: 404 });

  return prisma.bed.update({ where: { id: bedId }, data: { status } });
}

export async function bedSummary(hospitalId: string) {
  const beds = await prisma.bed.findMany({ where: { hospitalId } });
  const available = beds.filter((b) => b.status === "available").length;
  return { total: beds.length, available, occupied: beds.filter((b) => b.status === "occupied").length };
}