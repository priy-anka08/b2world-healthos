import { prisma } from "@/config/prisma";

interface BookInput {
  hospitalId: string;
  patientId: string;
  practitionerId: string;
  departmentId?: string;
  scheduledAt: Date;
  durationMins?: number;
}

export async function bookAppointment(input: BookInput) {
  // Basic double-booking guard. A production version would also check the
  // practitioner's configured availability windows / leave / shifts.
  const conflict = await prisma.appointment.findFirst({
    where: {
      practitionerId: input.practitionerId,
      status: { in: ["REQUESTED", "CONFIRMED", "CHECKED_IN"] },
      scheduledAt: input.scheduledAt,
    },
  });
  if (conflict) {
    throw Object.assign(new Error("Practitioner already booked at this time"), { statusCode: 409 });
  }

  return prisma.appointment.create({
    data: {
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      practitionerId: input.practitionerId,
      departmentId: input.departmentId,
      scheduledAt: input.scheduledAt,
      durationMins: input.durationMins ?? 20,
      status: "CONFIRMED",
    },
  });
}

/**
 * Smart queue estimate (spec §8). Deliberately simple and explainable for
 * the MVP: average of the practitioner's last N completed appointment
 * durations today, multiplied by patients still ahead in the queue.
 * MUST be presented to the user as an estimate, never a guarantee — see
 * the frontend copy in pages/appointments/QueueStatus.tsx.
 */
export async function estimateWaitMinutes(hospitalId: string, practitionerId: string, patientAppointmentId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [patientsAhead, recentDurations, target] = await Promise.all([
    prisma.appointment.count({
      where: {
        hospitalId,
        practitionerId,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        scheduledAt: { gte: today },
      },
    }),
    prisma.appointment.findMany({
      where: { hospitalId, practitionerId, status: "COMPLETED", scheduledAt: { gte: today } },
      select: { durationMins: true },
      take: 10,
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.appointment.findUnique({ where: { id: patientAppointmentId } }),
  ]);

  if (!target) {
    throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });
  }

  const avgDuration =
    recentDurations.length > 0
      ? recentDurations.reduce((sum, a) => sum + a.durationMins, 0) / recentDurations.length
      : 20; // fallback default

  const aheadOfThisPatient = await prisma.appointment.count({
    where: {
      hospitalId,
      practitionerId,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
      scheduledAt: { gte: today, lt: target.scheduledAt },
    },
  });

  return {
    patientsAhead: aheadOfThisPatient,
    estimatedWaitMinutes: Math.round(aheadOfThisPatient * avgDuration),
    isEstimate: true,
    disclaimer: "This is an approximate estimate, not a guaranteed wait time.",
    totalQueueLength: patientsAhead,
  };
}

export async function listAppointments(hospitalId: string, opts: { date?: Date; practitionerId?: string }) {
  return prisma.appointment.findMany({
    where: {
      hospitalId,
      practitionerId: opts.practitionerId,
      ...(opts.date
        ? {
            scheduledAt: {
              gte: new Date(opts.date.setHours(0, 0, 0, 0)),
              lt: new Date(opts.date.setHours(23, 59, 59, 999)),
            },
          }
        : {}),
    },
    include: { patient: true, practitioner: { include: { user: true } } },
    orderBy: { scheduledAt: "asc" },
  });
}

/**
 * No-show risk (spec §14) — MVP version.
 *
 * This is a transparent, rule-based heuristic, NOT a trained model. It is
 * deliberately simple and explainable rather than routed through the AI
 * service, since a real predictive model needs a labeled historical
 * dataset this system doesn't have yet. Swap this out for a proper
 * ai-service call (see ai-service/app/routers/predictions.py) once there's
 * enough appointment history to train on.
 *
 * Signal used: this patient's own historical no-show rate at this
 * hospital. New patients with no history get a neutral baseline score.
 * Always returned with `isEstimate: true` and a disclaimer — this must
 * never be presented as a certainty, per spec §38 (AI outputs are
 * advisory, not authoritative).
 */
export async function estimateNoShowRisk(hospitalId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, hospitalId },
  });
  if (!appointment) {
    throw Object.assign(new Error("Appointment not found"), { statusCode: 404 });
  }

  const pastAppointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      patientId: appointment.patientId,
      status: { in: ["COMPLETED", "NO_SHOW", "CANCELLED"] },
      id: { not: appointmentId },
    },
    select: { status: true },
  });

  const total = pastAppointments.length;
  const noShows = pastAppointments.filter((a) => a.status === "NO_SHOW").length;

  // Baseline for patients with no history: a modest default rather than 0,
  // since "no data" isn't the same as "will definitely show up".
  const BASELINE = 0.15;
  const riskScore = total === 0 ? BASELINE : noShows / total;

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { noShowRiskScore: riskScore },
  });

  return {
    riskScore: Math.round(riskScore * 100) / 100,
    basedOnAppointments: total,
    level: riskScore >= 0.4 ? "high" : riskScore >= 0.2 ? "medium" : "low",
    isEstimate: true,
    method: "rule_based_v1",
    disclaimer:
      "This is a heuristic estimate based on the patient's past attendance, not a guarantee of behavior. Use it as one input among others, not a sole basis for decisions.",
  };
}