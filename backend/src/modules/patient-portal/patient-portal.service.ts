import crypto from "crypto";
import axios from "axios";
import { prisma } from "@/config/prisma";
import { env } from "@/config/env";
import { hashPassword } from "@/modules/auth/auth.service";

interface InvitePortalInput {
  hospitalId: string;
  patientId: string;
  email: string;
  temporaryPassword: string;
}

export async function invitePortalAccess(input: InvitePortalInput) {
  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, hospitalId: input.hospitalId } });
  if (!patient) throw Object.assign(new Error("Patient not found"), { statusCode: 404 });
  if (patient.userId) throw Object.assign(new Error("This patient already has portal access"), { statusCode: 409 });

  const role = await prisma.role.findUnique({ where: { name: "PATIENT" } });
  if (!role) throw Object.assign(new Error("PATIENT role not seeded"), { statusCode: 500 });

  const passwordHash = await hashPassword(input.temporaryPassword);
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {},
    create: { email: input.email, firstName: patient.firstName, lastName: patient.lastName, passwordHash },
  });

  await prisma.userHospital.upsert({
    where: { userId_hospitalId_roleId: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id } },
    update: {},
    create: { userId: user.id, hospitalId: input.hospitalId, roleId: role.id },
  });

  await prisma.patient.update({ where: { id: input.patientId }, data: { userId: user.id } });

  return { userId: user.id, email: user.email };
}

export async function getMyPortalData(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      appointments: { orderBy: { scheduledAt: "desc" }, take: 20, include: { practitioner: { include: { user: true } } } },
      encounters: {
        orderBy: { startedAt: "desc" },
        take: 10,
        include: { medicationRequests: true, clinicalNotes: { select: { content: true, createdAt: true } } },
      },
      invoices: { orderBy: { createdAt: "desc" }, take: 10, include: { payments: true } },
      labOrders: {
        where: { status: "reviewed" },
        include: { labTest: true, results: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!patient) throw Object.assign(new Error("No patient record linked to this account"), { statusCode: 404 });
  return patient;
}

// --- Self-registration (spec §6/§30 "Register/login") ---
interface RegisterInput {
  hospitalCode: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dob?: Date;
}

export async function registerPatient(input: RegisterInput) {
  const hospital = await prisma.hospital.findUnique({ where: { code: input.hospitalCode } });
  if (!hospital) throw Object.assign(new Error("Unknown hospital code"), { statusCode: 404 });

  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw Object.assign(new Error("An account with this email already exists"), { statusCode: 409 });

  const role = await prisma.role.findUnique({ where: { name: "PATIENT" } });
  if (!role) throw Object.assign(new Error("PATIENT role not seeded"), { statusCode: 500 });

  const passwordHash = await hashPassword(input.password);
  const patientCode = `SELF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const user = await prisma.user.create({
    data: { email: input.email, firstName: input.firstName, lastName: input.lastName, phone: input.phone, passwordHash },
  });

  await prisma.userHospital.create({ data: { userId: user.id, hospitalId: hospital.id, roleId: role.id } });

  const patient = await prisma.patient.create({
    data: {
      hospitalId: hospital.id,
      userId: user.id,
      patientCode,
      firstName: input.firstName,
      lastName: input.lastName,
      contactEmail: input.email,
      contactPhone: input.phone,
      dob: input.dob,
    },
  });

  return { userId: user.id, patientId: patient.id, patientCode, hospitalId: hospital.id };
}

// --- Patient AI Assistant (spec §31) ---
// Deliberately narrow: this can only ever see the CALLING patient's own
// upcoming appointments plus a static department directory. It has no
// access to other patients, other hospitals, or any write capability —
// unlike the staff-facing ai-copilot, which has broader (but still
// permission-gated) operational access. It should never be positioned as
// a diagnostic assistant.
export async function askPatientAssistant(userId: string, question: string) {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: {
      appointments: {
        orderBy: { scheduledAt: "asc" },
        where: { scheduledAt: { gte: new Date() } },
        take: 5,
        include: { practitioner: { include: { user: true } } },
      },
      hospital: { include: { departments: true } },
    },
  });
  if (!patient) throw Object.assign(new Error("No patient record linked to this account"), { statusCode: 404 });

  const contextData = {
    upcomingAppointments: patient.appointments.map((a) => ({
      when: a.scheduledAt,
      doctor: `Dr. ${a.practitioner?.user?.firstName ?? ""} ${a.practitioner?.user?.lastName ?? ""}`.trim(),
      status: a.status,
    })),
    hospitalDepartments: patient.hospital.departments.map((d) => d.name),
    documentsNeededForRegistration: "A government-issued photo ID and any previous medical records or referral letters.",
  };

  const aiRequest = await prisma.aIRequest.create({
    data: {
      hospitalId: patient.hospitalId,
      userId,
      feature: "patient_assistant",
      inputSummary: question,
      dataScope: { patientId: patient.id, scope: "own_record_only" },
    },
  });

  let answer: string;
  try {
    const { data } = await axios.post(`${env.aiServiceUrl}/copilot/query`, { question, contextData });
    answer = data.answer;
  } catch {
    answer = "The assistant is currently unavailable — please check your Appointments or My Portal pages directly.";
  }

  await prisma.aIOutput.create({
    data: { aiRequestId: aiRequest.id, output: { question, answer } as never, requiresApproval: false },
  });

  return {
    answer,
    disclaimer:
      "This assistant only answers administrative questions about your own appointments and hospital info — it cannot diagnose or give medical advice (spec §31).",
  };
}

// --- Booking (spec §30) ---
export async function listPractitionersForBooking(hospitalId: string) {
  return prisma.practitioner.findMany({
    where: { hospitalId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
}

export async function bookMyAppointment(userId: string, practitionerId: string, scheduledAt: Date, durationMins?: number) {
  const patient = await prisma.patient.findUnique({ where: { userId } });
  if (!patient) throw Object.assign(new Error("No patient record linked to this account"), { statusCode: 404 });
  const { bookAppointment } = await import("@/modules/appointments/appointments.service");
  return bookAppointment({ hospitalId: patient.hospitalId, patientId: patient.id, practitionerId, scheduledAt, durationMins });
}