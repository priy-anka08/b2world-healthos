import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ROLE_PERMISSIONS: Record<RoleName, [string, string][]> = {
  SUPER_ADMIN: [], // bypasses permission checks entirely — see rbac.guard.ts
  HOSPITAL_ADMIN: [
    ["patients", "read"], ["patients", "create"], ["appointments", "read"], ["appointments", "create"],
    ["departments", "read"], ["departments", "create"], ["users", "read"], ["users", "create"],
    ["audit_logs", "read"], ["staff", "read"], ["staff", "create"], ["billing", "read"], ["billing", "create"],
    ["inventory", "read"], ["inventory", "create"], ["reports", "read"], ["ai_copilot", "read"],
    ["practitioners", "read"], ["practitioners", "create"],
    ["pharmacy", "read"], ["pharmacy", "create"], ["laboratory", "read"], ["laboratory", "create"],
                ["beds", "read"], ["beds", "create"], ["assets", "read"], ["assets", "create"],
    ["documents", "read"], ["documents", "create"],
    ["ai_rag", "read"], ["ai_rag", "create"],
    ["clinical_notes", "read"], ["clinical_notes", "create"], ["prescriptions", "read"], ["prescriptions", "create"],
  ],
  DOCTOR: [
    ["patients", "read"], ["appointments", "read"], ["appointments", "create"],
    ["clinical_notes", "read"], ["clinical_notes", "create"], ["prescriptions", "read"], ["prescriptions", "create"],
    ["ai_copilot", "read"], ["practitioners", "read"], ["laboratory", "read"], ["laboratory", "create"],
    ["ai_rag", "read"],
  ],
  NURSE: [
    ["patients", "read"], ["appointments", "read"], ["beds", "read"], ["beds", "create"],
    ["practitioners", "read"],
  ],
  RECEPTIONIST: [
    ["patients", "read"], ["patients", "create"], ["appointments", "read"], ["appointments", "create"],
    ["practitioners", "read"], ["beds", "read"],
  ],
  PHARMACIST: [["pharmacy", "read"], ["pharmacy", "create"], ["inventory", "read"], ["inventory", "create"]],
  LAB_TECHNICIAN: [["laboratory", "read"], ["laboratory", "create"], ["patients", "read"]],
  ACCOUNTANT: [["billing", "read"], ["billing", "create"], ["payments", "read"], ["payments", "create"], ["reports", "read"]],
  PATIENT: [["appointments", "read"], ["appointments", "create"]],
};

async function main() {
  console.log("Seeding roles + permissions...");

  const roles: Record<string, { id: string }> = {};
  for (const name of Object.keys(ROLE_PERMISSIONS) as RoleName[]) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const [resource, action] of perms) {
      const permission = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roles[roleName].id, permissionId: permission.id } },
        update: {},
        create: { roleId: roles[roleName].id, permissionId: permission.id },
      });
    }
  }

  console.log("Seeding platform super admin...");
  const superAdminPassword = await bcrypt.hash("ChangeMe!123", 12);
  await prisma.user.upsert({
    where: { email: "superadmin@b2world.dev" },
    update: {},
    create: {
      email: "superadmin@b2world.dev",
      passwordHash: superAdminPassword,
      firstName: "Platform",
      lastName: "Admin",
      isSuperAdmin: true,
      status: "ACTIVE",
    },
  });

  console.log("Seeding demo organization + hospital...");
  const org = await prisma.organization.upsert({
    where: { slug: "demo-health-group" },
    update: {},
    create: { name: "Demo Health Group", slug: "demo-health-group" },
  });

  const hospital = await prisma.hospital.upsert({
    where: { code: "DEMO-01" },
    update: {},
    create: { organizationId: org.id, name: "Demo General Hospital", code: "DEMO-01" },
  });

  console.log("Seeding demo hospital admin...");
  const adminPassword = await bcrypt.hash("ChangeMe!123", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo-hospital.dev" },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@demo-hospital.dev",
      passwordHash: adminPassword,
      firstName: "Demo",
      lastName: "Admin",
      status: "ACTIVE",
    },
  });

  await prisma.userHospital.upsert({
    where: {
      userId_hospitalId_roleId: {
        userId: adminUser.id,
        hospitalId: hospital.id,
        roleId: roles.HOSPITAL_ADMIN.id,
      },
    },
    update: {},
    create: { userId: adminUser.id, hospitalId: hospital.id, roleId: roles.HOSPITAL_ADMIN.id },
  });

  await prisma.department.upsert({
    where: { hospitalId_code: { hospitalId: hospital.id, code: "GEN" } },
    update: {},
    create: { hospitalId: hospital.id, name: "General Medicine", code: "GEN" },
  });

  console.log("Done. Login with:");
  console.log("  Super admin:   superadmin@b2world.dev / ChangeMe!123");
  console.log("  Hospital admin: admin@demo-hospital.dev / ChangeMe!123 (hospital: DEMO-01)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());