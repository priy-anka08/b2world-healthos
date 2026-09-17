import { prisma } from "@/config/prisma";

interface ScheduleSuggestionInput {
  hospitalId: string;
  date: string; // ISO date, e.g. "2025-07-15"
  departmentId?: string;
}

interface ShiftSlot {
  name: string;
  startHour: number;
  endHour: number;
}

const DEFAULT_SHIFTS: ShiftSlot[] = [
  { name: "Morning", startHour: 6, endHour: 14 },
  { name: "Afternoon", startHour: 14, endHour: 22 },
  { name: "Night", startHour: 22, endHour: 6 },
];

/**
 * AI Staff Scheduling Suggestion (spec §27)
 *
 * Analyzes:
 *  - Staff availability (who doesn't have a shift or leave that day)
 *  - Department assignment
 *  - Historical appointment volume for the target date's day-of-week
 *  - Existing shifts to avoid double-booking
 *
 * Returns a RECOMMENDED schedule. Administrator must approve before applying (spec §27).
 */
export async function generateScheduleSuggestion(input: ScheduleSuggestionInput) {
  const { hospitalId, date, departmentId } = input;
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat

  // 1. Get all staff for this hospital (optionally filtered by department)
  const staffMembers = await prisma.staff.findMany({
    where: {
      hospitalId,
      ...(departmentId ? { departmentId } : {}),
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true, status: true } },
      department: { select: { name: true } },
      shifts: {
        where: {
          startsAt: { gte: new Date(`${date}T00:00:00Z`) },
          endsAt: { lte: new Date(`${date}T23:59:59Z`) },
        },
      },
    },
  });

  // Filter out inactive users and those already on leave
  const availableStaff = staffMembers.filter(
    (s) => s.user.status === "ACTIVE" && !s.shifts.some((sh) => sh.status === "leave")
  );

  // 2. Get historical appointment count for this day-of-week (last 8 weeks)
  const eightWeeksAgo = new Date(targetDate);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const historicalAppointments = await prisma.appointment.findMany({
    where: {
      hospitalId,
      scheduledAt: { gte: eightWeeksAgo, lte: targetDate },
      status: { notIn: ["CANCELLED"] },
      ...(departmentId ? { departmentId } : {}),
    },
    select: { scheduledAt: true },
  });

  // Count appointments on the same day-of-week
  const sameDayAppointments = historicalAppointments.filter(
    (a) => a.scheduledAt.getDay() === dayOfWeek
  );
  const weeksOfData = Math.max(1, Math.ceil(
    (targetDate.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)
  ));
  const avgDailyVolume = Math.round(sameDayAppointments.length / weeksOfData);

  // 3. Calculate staffing needs based on volume
  // Simple heuristic: 1 staff per 8 patients per shift, minimum 1 per shift
  const staffPerShift = Math.max(1, Math.ceil(avgDailyVolume / (DEFAULT_SHIFTS.length * 8)));

  // 4. Generate shift suggestions — round-robin distribute available staff
  const alreadyScheduledIds = new Set(
    staffMembers
      .filter((s) => s.shifts.some((sh) => sh.status === "scheduled" || sh.status === "completed"))
      .map((s) => s.id)
  );

  const unscheduled = availableStaff.filter((s) => !alreadyScheduledIds.has(s.id));
  let staffIndex = 0;

  const suggestions = DEFAULT_SHIFTS.map((shift) => {
    const assigned: typeof unscheduled = [];
    for (let i = 0; i < staffPerShift && staffIndex < unscheduled.length; i++) {
      assigned.push(unscheduled[staffIndex]);
      staffIndex++;
    }
    return {
      shift: shift.name,
      startHour: shift.startHour,
      endHour: shift.endHour,
      suggestedStaff: assigned.map((s) => ({
        staffId: s.id,
        userId: s.userId,
        name: `${s.user.firstName} ${s.user.lastName}`,
        department: s.department?.name ?? "Unassigned",
        jobTitle: s.jobTitle,
      })),
      suggestedCount: staffPerShift,
      assignedCount: assigned.length,
      understaffed: assigned.length < staffPerShift,
    };
  });

  return {
    date,
    hospitalId,
    departmentId: departmentId ?? null,
    forecastedPatientVolume: avgDailyVolume,
    historicalDataWeeks: weeksOfData,
    totalAvailableStaff: availableStaff.length,
    totalAlreadyScheduled: alreadyScheduledIds.size,
    shifts: suggestions,
    note: "This is an AI-generated recommendation. Administrator must review and approve before applying.",
  };
}

/**
 * Apply approved schedule — create Shift records for the suggested staff.
 */
export async function applySchedule(
  hospitalId: string,
  date: string,
  shifts: { staffId: string; startHour: number; endHour: number }[]
) {
  const created = [];
  for (const shift of shifts) {
    // Verify staff belongs to this hospital
    const staff = await prisma.staff.findFirst({
      where: { id: shift.staffId, hospitalId },
    });
    if (!staff) continue;

    const startsAt = new Date(`${date}T${String(shift.startHour).padStart(2, "0")}:00:00Z`);
    let endsAt: Date;
    if (shift.endHour <= shift.startHour) {
      // Night shift crosses midnight
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      endsAt = new Date(`${nextDay.toISOString().split("T")[0]}T${String(shift.endHour).padStart(2, "0")}:00:00Z`);
    } else {
      endsAt = new Date(`${date}T${String(shift.endHour).padStart(2, "0")}:00:00Z`);
    }

    const record = await prisma.shift.create({
      data: { staffId: shift.staffId, startsAt, endsAt, status: "scheduled" },
    });
    created.push(record);
  }
  return created;
}
