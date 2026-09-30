export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "B2World HealthOS API",
    version: "0.1.0",
    description:
      "Multi-tenant hospital operations & AI intelligence platform. All /api/v1 routes except /auth and /portal/register require a Bearer JWT, and hospital-scoped routes require an active hospital context.",
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
    { name: "Staff" }, { name: "Assets" }, { name: "Suppliers" }, { name: "Notifications" },
    { name: "Patient Portal" }, { name: "AI OCR" }, { name: "AI Copilot" }, { name: "AI Voice" },
    { name: "AI Orchestrator" }, { name: "AI Predictions" }, { name: "Hospitals" }, { name: "Monitoring" },
  ],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"], security: [], summary: "Log in with email + password",
        responses: { "200": { description: "JWT + user profile" }, "401": { description: "Invalid credentials" } },
      },
    },
    "/auth/forgot-password": {
      post: { tags: ["Auth"], security: [], summary: "Request a password reset (dev mode returns the token directly)", responses: { "200": { description: "Generic success message" } } },
    },
    "/auth/reset-password": {
      post: { tags: ["Auth"], security: [], summary: "Reset password with a token from /forgot-password", responses: { "200": { description: "{ success: true }" } } },
    },
    "/patients": {
      get: { tags: ["Patients"], summary: "List patients in the active hospital", responses: { "200": { description: "Array of patients" } } },
      post: { tags: ["Patients"], summary: "Register a new patient (flags possible duplicates, spec §5)", responses: { "201": { description: "Created patient" }, "409": { description: "Possible duplicate found" } } },
    },
    "/patients/{id}/export": {
      get: { tags: ["Patients"], summary: "Export everything this hospital holds about one patient (spec §37)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Structured export bundle" } } },
    },
    "/patients/{id}/consents": {
      get: { tags: ["Patients"], summary: "List a patient's consent records", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Array of consents" } } },
      post: { tags: ["Patients"], summary: "Grant or revoke a patient consent", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Created consent record" } } },
    },
    "/appointments": {
      get: { tags: ["Appointments"], summary: "List appointments, optionally filtered by ?date=", responses: { "200": { description: "Array of appointments" } } },
      post: { tags: ["Appointments"], summary: "Book an appointment", responses: { "201": { description: "Created appointment" } } },
    },
    "/beds/summary": {
      get: { tags: ["Beds"], summary: "Bed occupancy counts", responses: { "200": { description: "{ total, available, occupied }" } } },
    },
    "/inventory": {
      get: { tags: ["Inventory"], summary: "List inventory items with batches", responses: { "200": { description: "Array of items" } } },
      post: { tags: ["Inventory"], summary: "Create an inventory item", responses: { "201": { description: "Created item" } } },
    },
    "/inventory/expiring": {
      get: { tags: ["Inventory"], summary: "Batches expiring within N days (default 30)", responses: { "200": { description: "Array of expiring batches" } } },
    },
    "/billing/invoices": {
      get: { tags: ["Billing"], summary: "List invoices with payments/refunds", responses: { "200": { description: "Array of invoices" } } },
      post: { tags: ["Billing"], summary: "Create an invoice", responses: { "201": { description: "Created invoice" } } },
    },
    "/laboratory/orders": {
      get: { tags: ["Laboratory"], summary: "List lab orders", responses: { "200": { description: "Array of orders" } } },
      post: { tags: ["Laboratory"], summary: "Create a lab order", responses: { "201": { description: "Created order" } } },
    },
    "/staff": {
      get: { tags: ["Staff"], summary: "List staff with shifts", responses: { "200": { description: "Array of staff" } } },
    },
    "/staff/scheduling/suggest": {
      post: { tags: ["Staff"], summary: "AI-suggested staffing schedule (spec §27), requires admin approval before applying", responses: { "200": { description: "Suggested schedule" } } },
    },
    "/assets": {
      get: { tags: ["Assets"], summary: "List hospital assets/equipment", responses: { "200": { description: "Array of assets" } } },
      post: { tags: ["Assets"], summary: "Add an asset", responses: { "201": { description: "Created asset" } } },
    },
    "/assets/maintenance-risk": {
      get: { tags: ["Assets"], summary: "Predictive maintenance risk score for every asset (spec §29)", responses: { "200": { description: "Array of risk scores, sorted highest-risk first" } } },
    },
    "/suppliers": {
      get: { tags: ["Suppliers"], summary: "List suppliers and purchase orders", responses: { "200": { description: "Array of suppliers" } } },
    },
    "/notifications": {
      get: { tags: ["Notifications"], summary: "List notifications for the current user", responses: { "200": { description: "Array of notifications" } } },
    },
    "/notifications/run-checks": {
      post: { tags: ["Notifications"], summary: "Sweep low-stock/expiring-batch/appointment-reminder triggers (spec §7, §18, §19)", responses: { "200": { description: "{ notificationsCreated, breakdown }" } } },
    },
    "/portal/register": {
      post: { tags: ["Patient Portal"], security: [], summary: "Public patient self-registration (spec §6/§30), auto-logs in", responses: { "201": { description: "JWT + user + patientCode" } } },
    },
    "/portal/me": {
      get: { tags: ["Patient Portal"], summary: "The logged-in patient's own appointments/prescriptions/invoices", responses: { "200": { description: "Patient record" } } },
    },
    "/portal/assistant/ask": {
      post: { tags: ["Patient Portal"], summary: "Patient AI Assistant — own-record-only Q&A (spec §31)", responses: { "200": { description: "{ answer, disclaimer }" } } },
    },
    "/ai/ocr/extract": {
      post: { tags: ["AI OCR"], summary: "OCR + classification + field extraction on a document image (spec §12, §21). Never auto-commits.", responses: { "200": { description: "Structured draft — requiresApproval: true" } } },
    },
    "/ai/ocr/{id}/verify": {
      post: { tags: ["AI OCR"], summary: "Human verification — the only path that commits an OCR draft to the record", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Verified document" } } },
    },
    "/ai/copilot/query": {
      post: { tags: ["AI Copilot"], summary: "Ask the HealthOS AI Copilot a natural-language operations question (spec §33)", responses: { "200": { description: "AI answer + supporting data" } } },
    },
    "/ai/voice/transcribe": {
      post: { tags: ["AI Voice"], summary: "Transcribe spoken audio and route through the AI Copilot (spec §32) — read-only", responses: { "200": { description: "{ transcript, answer }" } } },
    },
    "/ai/orchestrator/query": {
      post: { tags: ["AI Orchestrator"], summary: "Multi-agent read-only report (Operations/Finance/Inventory agents, spec §34)", responses: { "200": { description: "{ agentsInvoked, results }" } } },
    },
    "/ai/predictions/bed-occupancy": {
      get: { tags: ["AI Predictions"], summary: "Bed occupancy forecast (spec §15)", responses: { "200": { description: "Forecast" } } },
    },
    "/ai/predictions/no-show-risk": {
      get: { tags: ["AI Predictions"], summary: "No-show risk for appointments in the next 48h (spec §14)", responses: { "200": { description: "Array of risk scores" } } },
    },
    "/ai/predictions/emergency-forecast": {
      get: { tags: ["AI Predictions"], summary: "Emergency Department busy-period forecast (spec §16)", responses: { "200": { description: "Hourly volume + busiest window" } } },
    },
    "/ai/predictions/revenue-anomaly": {
      get: { tags: ["AI Predictions"], summary: "Revenue anomaly detection (spec §25)", responses: { "200": { description: "Anomaly flag + supporting metrics" } } },
    },
    "/hospitals/{id}/branding": {
      get: { tags: ["Hospitals"], summary: "Get a hospital's white-label branding", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "{ hospitalName, branding }" } } },
      patch: { tags: ["Hospitals"], summary: "Update white-label branding (Hospital Admin or Super Admin, spec Phase 6)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Updated branding" } } },
    },
    "/monitoring/summary": {
      get: { tags: ["Monitoring"], summary: "Platform-wide health snapshot (Super Admin only, spec Phase 6)", responses: { "200": { description: "Uptime + counts" } } },
    },
  },
} as const;