import { prisma } from "@/config/prisma";

// Starting a consultation gets-or-creates the Encounter tied to an
// appointment. Idempotent: calling it twice for the same appointment
// returns the same open encounter rather than creating duplicates.
export async function startEncounter(hospitalId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId },
    include: { encounter: true },
  });
  if (!appointment) throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });

  if (appointment.encounter) return appointment.encounter;

  const encounter = await prisma.encounter.create({
    data: {
      hospitalId,
      patientId: appointment.patientId,
      practitionerId: appointment.practitionerId,
      appointmentId: appointment.id,
      status: "open",
    },
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "IN_PROGRESS" },
  });

  return encounter;
}

export async function getEncounter(hospitalId: string, encounterId: string) {
  return prisma.encounter.findFirst({
    where: { id: encounterId, hospitalId },
    include: {
      clinicalNotes: { orderBy: { createdAt: "desc" } },
      medicationRequests: { orderBy: { createdAt: "desc" } },
      patient: { select: { firstName: true, lastName: true, patientCode: true } },
      practitioner: { select: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
}

export async function closeEncounter(hospitalId: string, encounterId: string) {
  const encounter = await prisma.encounter.findFirst({ where: { id: encounterId, hospitalId } });
  if (!encounter) throw Object.assign(new Error("Encounter not found"), { statusCode: 404 });

  const updated = await prisma.encounter.update({
    where: { id: encounterId },
    data: { status: "closed", endedAt: new Date() },
  });

  if (encounter.appointmentId) {
    await prisma.appointment.update({
      where: { id: encounter.appointmentId },
      data: { status: "COMPLETED" },
    });
  }

  return updated;
}