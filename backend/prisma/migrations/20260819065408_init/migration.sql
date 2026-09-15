CREATE EXTENSION IF NOT EXISTS vector;
-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PHARMACIST', 'LAB_TECHNICIAN', 'ACCOUNTANT', 'PATIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "planTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "RoleName" NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_hospitals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT,
    "patientCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "bloodGroup" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_documents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "ocrStatus" TEXT,
    "extractedData" JSONB,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_consents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "patient_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioners" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialization" TEXT,
    "licenseNumber" TEXT,
    "departmentId" TEXT,

    CONSTRAINT "practitioners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "jobTitle" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "departmentId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER NOT NULL DEFAULT 20,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "noShowRiskScore" DOUBLE PRECISION,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encounters" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "practitionerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',

    CONSTRAINT "encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_notes" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiDraftOf" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinical_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_reports" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "labOrderId" TEXT,
    "summary" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "diagnostic_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_requests" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "medicationId" TEXT,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "labTestId" TEXT NOT NULL,
    "orderedByUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ordered',
    "technicianUserId" TEXT,
    "predictedCompletionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "referenceRange" TEXT,
    "flag" TEXT,
    "aiExtracted" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "number" TEXT NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "reorderLevel" INTEGER NOT NULL DEFAULT 10,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "lineItems" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "purchaseDate" TIMESTAMP(3),
    "warrantyUntil" TIMESTAMP(3),
    "maintenanceRiskScore" DOUBLE PRECISION,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768),

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "vector" vector(768),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "inputSummary" TEXT,
    "dataScope" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_outputs" (
    "id" TEXT NOT NULL,
    "aiRequestId" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" TEXT NOT NULL,
    "aiOutputId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "seatLimit" INTEGER,
    "usageLimits" JSONB,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_code_key" ON "hospitals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_hospitalId_code_key" ON "departments"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_hospitals_userId_hospitalId_roleId_key" ON "user_hospitals"("userId", "hospitalId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_hospitalId_patientCode_key" ON "patients"("hospitalId", "patientCode");

-- CreateIndex
CREATE UNIQUE INDEX "practitioners_userId_key" ON "practitioners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "encounters_appointmentId_key" ON "encounters"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_reports_labOrderId_key" ON "diagnostic_reports"("labOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_hospitalId_code_key" ON "lab_tests"("hospitalId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "beds_hospitalId_code_key" ON "beds"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "audit_logs_hospitalId_createdAt_idx" ON "audit_logs"("hospitalId", "createdAt");

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_hospitals" ADD CONSTRAINT "user_hospitals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_hospitals" ADD CONSTRAINT "user_hospitals_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_hospitals" ADD CONSTRAINT "user_hospitals_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_documents" ADD CONSTRAINT "patient_documents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_consents" ADD CONSTRAINT "patient_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_reports" ADD CONSTRAINT "diagnostic_reports_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_requests" ADD CONSTRAINT "medication_requests_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "lab_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_outputs" ADD CONSTRAINT "ai_outputs_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "ai_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_aiOutputId_fkey" FOREIGN KEY ("aiOutputId") REFERENCES "ai_outputs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
