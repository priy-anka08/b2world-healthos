import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { env } from "@/config/env";
import { errorHandler } from "@/common/errors/error-handler";

import { authRouter } from "@/modules/auth/auth.routes";
import { organizationsRouter } from "@/modules/organizations/organizations.routes";
import { hospitalsRouter } from "@/modules/hospitals/hospitals.routes";
import { departmentsRouter } from "@/modules/departments/departments.routes";
import { usersRouter } from "@/modules/users/users.routes";
import { patientsRouter } from "@/modules/patients/patients.routes";
import { practitionersRouter } from "@/modules/practitioners/practitioners.routes";
import { appointmentsRouter } from "@/modules/appointments/appointments.routes";
import { auditRouter } from "@/modules/audit/audit.routes";
import { pharmacyRouter } from "@/modules/pharmacy/pharmacy.routes";
import { billingRouter } from "@/modules/billing/billing.routes";
import { laboratoryRouter } from "@/modules/laboratory/laboratory.routes";
import { bedsRouter } from "@/modules/beds/beds.routes";
import { staffRouter } from "@/modules/staff/staff.routes";
import { assetsRouter } from "@/modules/assets/assets.routes";
import { encountersRouter } from "@/modules/encounters/encounters.routes";
import { clinicalNotesRouter } from "@/modules/clinical-notes/clinical-notes.routes";
import { prescriptionsRouter } from "@/modules/prescriptions/prescriptions.routes";
import { aiCopilotRouter } from "@/modules/ai-copilot/ai-copilot.routes";
import { aiDocumentationRouter } from "@/modules/ai-documentation/ai-documentation.routes";
import { aiSummaryRouter } from "@/modules/ai-summary/ai-summary.routes";
import { aiPredictionsRouter } from "@/modules/ai-predictions/ai-predictions.routes";
import { suppliersRouter } from "@/modules/suppliers/suppliers.routes";
import { notificationsRouter } from "@/modules/notifications/notifications.routes";
import { documentsRouter } from "@/modules/documents/documents.routes";
import { reportsRouter } from "@/modules/reports/reports.routes";
import { subscriptionsRouter } from "@/modules/subscriptions/subscriptions.routes";
import { patientPortalRouter } from "@/modules/patient-portal/patient-portal.routes";
import { fhirRouter } from "@/modules/fhir/fhir.routes";
import { aiRagRouter } from "@/modules/ai-rag/ai-rag.routes";
import { inventoryRouter } from "@/modules/inventory/inventory.routes";
import { aiOcrRouter } from "@/modules/ai-ocr/ai-ocr.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  app.use(pinoHttp({ redact: ["req.headers.authorization"] }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 500,
      standardHeaders: true,
    })
  );

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "healthos-backend" }));

  // --- API v1 ---
  const v1 = express.Router();
  v1.use("/auth", authRouter);
  v1.use("/organizations", organizationsRouter);
  v1.use("/hospitals", hospitalsRouter);
  v1.use("/departments", departmentsRouter);
  v1.use("/users", usersRouter);
  v1.use("/patients", patientsRouter);
  v1.use("/practitioners", practitionersRouter);
  v1.use("/appointments", appointmentsRouter);
  v1.use("/audit-logs", auditRouter);

  v1.use("/pharmacy", pharmacyRouter);
  v1.use("/billing", billingRouter);
  v1.use("/laboratory", laboratoryRouter);
  v1.use("/beds", bedsRouter);
  v1.use("/staff", staffRouter);
  v1.use("/assets", assetsRouter);
  v1.use("/encounters", encountersRouter);
  v1.use("/clinical-notes", clinicalNotesRouter);
  v1.use("/prescriptions", prescriptionsRouter);
  v1.use("/ai/copilot", aiCopilotRouter);
  v1.use("/ai/documentation", aiDocumentationRouter);
  v1.use("/ai/summary", aiSummaryRouter);
  v1.use("/ai/predictions", aiPredictionsRouter);
  v1.use("/suppliers", suppliersRouter);
  v1.use("/notifications", notificationsRouter);
  v1.use("/documents", documentsRouter);
  v1.use("/reports", reportsRouter);
  v1.use("/subscriptions", subscriptionsRouter);
  v1.use("/portal", patientPortalRouter);
  v1.use("/fhir", fhirRouter);
  v1.use("/ai/rag", aiRagRouter);
  v1.use("/inventory", inventoryRouter);
  v1.use("/ai/ocr", aiOcrRouter);

  app.use("/api/v1", v1);

  app.use(errorHandler);
  return app;
}