export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "B2World HealthOS API",
    version: "0.1.0",
    description:
      "Multi-tenant hospital operations & AI intelligence platform. All /api/v1 routes except /auth require a Bearer JWT, and hospital-scoped routes require an active hospital context. This document covers representative endpoints — every module under backend/src/modules follows the same auth + RBAC + tenant-scoping pattern shown here.",
  },
  servers: [{ url: "/api/v1", description: "API v1" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: { Error: { type: "object", properties: { error: { type: "string" } } } },
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Auth" }, { name: "Patients" }, { name: "Appointments" }, { name: "Beds" },
    { name: "Pharmacy" }, { name: "Inventory" }, { name: "Billing" }, { name: "Laboratory" },
    { name: "AI OCR" }, { name: "AI Copilot" }, { name: "AI Voice" },
  ],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        security: [],
        summary: "Log in with email + password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": { description: "JWT + user profile" },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/patients": {
      get: { tags: ["Patients"], summary: "List patients in the active hospital", responses: { "200": { description: "Array of patients" } } },
      post: { tags: ["Patients"], summary: "Register a new patient (flags possible duplicates, spec §5)", responses: { "201": { description: "Created patient" } } },
    },
    "/appointments": {
      get: {
        tags: ["Appointments"],
        summary: "List appointments, optionally filtered by ?date=",
        parameters: [{ name: "date", in: "query", schema: { type: "string", format: "date-time" } }],
        responses: { "200": { description: "Array of appointments" } },
      },
      post: { tags: ["Appointments"], summary: "Book an appointment", responses: { "201": { description: "Created appointment" } } },
    },
    "/beds/summary": {
      get: { tags: ["Beds"], summary: "Bed occupancy counts", responses: { "200": { description: "{ total, available, occupied }" } } },
    },
    "/inventory": {
      get: {
        tags: ["Inventory"],
        summary: "List inventory items with their batches",
        parameters: [{ name: "category", in: "query", schema: { type: "string", enum: ["medicine", "consumable", "equipment_part"] } }],
        responses: { "200": { description: "Array of items" } },
      },
      post: { tags: ["Inventory"], summary: "Create an inventory item", responses: { "201": { description: "Created item" } } },
    },
    "/inventory/{id}/batches": {
      post: {
        tags: ["Inventory"],
        summary: "Add a stock batch (spec §17 — batch/expiry tracking)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created batch" } },
      },
    },
    "/inventory/expiring": {
      get: {
        tags: ["Inventory"],
        summary: "Batches expiring within N days (default 30)",
        parameters: [{ name: "days", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Array of expiring batches" } },
      },
    },
    "/billing/invoices": {
      get: { tags: ["Billing"], summary: "List invoices with payments/refunds", responses: { "200": { description: "Array of invoices" } } },
      post: { tags: ["Billing"], summary: "Create an invoice from line items", responses: { "201": { description: "Created invoice" } } },
    },
    "/laboratory/orders": {
      get: { tags: ["Laboratory"], summary: "List lab orders", responses: { "200": { description: "Array of lab orders" } } },
      post: { tags: ["Laboratory"], summary: "Create a lab order", responses: { "201": { description: "Created order" } } },
    },
    "/ai/ocr/extract": {
      post: {
        tags: ["AI OCR"],
        summary: "OCR + classification + field extraction on a document image (spec §12, §21). Never auto-commits to the patient record.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["patientId", "imageBase64"],
                properties: {
                  patientId: { type: "string", format: "uuid" },
                  documentType: { type: "string", enum: ["prescription", "lab_report", "discharge_summary", "referral"] },
                  imageBase64: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Structured draft — requiresApproval: true until verified" } },
      },
    },
    "/ai/ocr/{id}/verify": {
      post: {
        tags: ["AI OCR"],
        summary: "Human verification — the only path that commits an OCR draft to the patient record",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Verified document" } },
      },
    },
    "/ai/copilot/query": {
      post: { tags: ["AI Copilot"], summary: "Ask the HealthOS AI Copilot a natural-language operations question (spec §33)", responses: { "200": { description: "AI answer + supporting data" } } },
    },
    "/ai/voice/transcribe": {
      post: {
        tags: ["AI Voice"],
        summary: "Transcribe spoken audio and route it through the AI Copilot (spec §32) — read-only, never books anything",
        responses: { "200": { description: "{ transcript, answer, dataUsed }" } },
      },
    },
  },
} as const;