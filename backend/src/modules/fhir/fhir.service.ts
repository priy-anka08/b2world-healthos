import { prisma } from "@/config/prisma";

// FHIR-lite translation layer (spec §35). This does NOT change the core
// schema — it maps the existing Patient model onto a FHIR-shaped JSON
// response at the API boundary, which is the standard approach: keep the
// internal model as-is, translate on the way out.
export async function getFhirPatient(hospitalId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId } });
  if (!patient) return null;

  return {
    resourceType: "Patient",
    id: patient.id,
    identifier: [{ system: "urn:b2world:patient-code", value: patient.patientCode }],
    name: [{ family: patient.lastName, given: [patient.firstName] }],
    gender: patient.gender?.toLowerCase(),
    birthDate: patient.dob?.toISOString().slice(0, 10),
    telecom: [
      ...(patient.contactPhone ? [{ system: "phone", value: patient.contactPhone }] : []),
      ...(patient.contactEmail ? [{ system: "email", value: patient.contactEmail }] : []),
    ],
    address: patient.address ? [{ text: patient.address }] : undefined,
    extension: patient.allergies.length
      ? [{ url: "http://b2world.dev/fhir/allergies", valueString: patient.allergies.join(", ") }]
      : undefined,
  };
}