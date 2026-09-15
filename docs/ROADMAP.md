# Roadmap (spec §41-42)

Checklist form of the spec's development phases, each item mapped to where
it lives (or should live) in this repo. Check items off as you implement
them for real.

## Phase 1 — Foundation ✅ (this scaffold)
- [x] Project architecture — this monorepo (`backend/`, `frontend/`, `ai-service/`)
- [x] Database architecture — `backend/prisma/schema.prisma`
- [x] Authentication — `backend/src/modules/auth/`
- [x] RBAC — `backend/src/common/guards/rbac.guard.ts` + `Role`/`Permission` models
- [x] Multi-tenancy — `backend/src/common/middleware/tenant.middleware.ts`
- [x] Hospital onboarding — `backend/src/modules/hospitals/`
- [x] Admin dashboard (basic) — `frontend/src/pages/dashboard/`
- [x] Audit logging — `backend/src/modules/audit/`, `writeAuditLog()`
- [ ] MFA for privileged accounts (flagged TODO in `auth.service.ts`)
- [ ] Password reset / invite-by-email flow (flagged TODO in `users.routes.ts`)

## Phase 2 — Core Hospital Management
- [x] Patients (full CRUD + duplicate detection) — `modules/patients/`
- [x] Appointments (booking + queue estimate) — `modules/appointments/`
- [ ] Doctors/Practitioners — extend `Practitioner` model with a dedicated module
- [ ] Staff — `modules/staff/` (stub)
- [ ] Departments (basic CRUD exists) — extend `modules/departments/`
- [ ] Queue / doctor dashboard UI — `frontend/src/pages/appointments/`
- [ ] Patient portal (self-registration, view-only endpoints scoped to `req.auth.userId`'s linked Patient row)

## Phase 3 — Hospital Operations
- [ ] Beds/Wards/Rooms — `modules/beds/`, `modules/wards/`, `modules/rooms/`
- [ ] Laboratory — `modules/laboratory/`
- [ ] Pharmacy — `modules/pharmacy/`
- [ ] Inventory / Suppliers / Purchase Orders — `modules/inventory/`, `modules/suppliers/`, `modules/purchase-orders/`
- [ ] Billing / Payments / Refunds — `modules/billing/`, `modules/payments/`
- [ ] Assets / Maintenance — `modules/assets/`, `modules/maintenance/`

## Phase 4 — AI (foundational)
- [ ] OCR pipeline — `ai-service/app/routers/ocr.py` + PaddleOCR wiring
- [ ] Document classification — extend `ocr.py`
- [ ] RAG — `ai-service/app/routers/rag.py` + `document_chunks`/`embeddings` (pgvector)
- [ ] AI hospital assistant (RAG-backed Q&A) — same as above, exposed via `modules/ai-rag/`
- [ ] AI documentation assistant — `ai-service/app/routers/documentation.py` + `modules/clinical-notes/`
- [ ] AI summarization — `ai-service/app/routers/summarization.py`
- [ ] AI analytics (basic) — `ai-service/app/routers/predictions.py`

## Phase 5 — Advanced AI
- [ ] No-show prediction — `predictions.py`, surfaced on `Appointment.noShowRiskScore`
- [ ] Bed occupancy forecasting
- [ ] Pharmacy inventory prediction (reorder / expiry)
- [ ] Revenue anomaly detection
- [ ] Staff scheduling suggestions
- [ ] Equipment maintenance risk — surfaced on `Asset.maintenanceRiskScore`
- [ ] Voice assistant (Whisper/faster-whisper)
- [ ] Multi-agent orchestration (spec §34 — Operations/Finance/Inventory agents behind an orchestrator + human approval gate)

## Phase 6 — Commercialization
- [ ] Subscription management — `modules/subscriptions/` + `Subscription` model
- [ ] Usage limits enforcement (tie into `Subscription.usageLimits`)
- [ ] Organization settings UI
- [ ] Billing for the platform itself (distinct from hospital patient billing)
- [ ] Platform-level reports for Super Admin
- [ ] White-label support
- [ ] Production deployment (see `docs/SECURITY.md` before going live)
- [ ] Monitoring (structured logs already via pino; add metrics/alerting)

## MVP deliverable checklist (spec §42)

Core: [x] app runs, [x] auth, [x] RBAC, [x] multi-tenancy, [x] patients,
[ ] doctors module, [x] appointments, [ ] patient portal, [x] dashboard
(basic), [ ] billing, [ ] pharmacy/inventory, [ ] lab, [x] audit logging.

AI: [ ] OCR, [ ] RAG assistant, [ ] ops assistant, [ ] documentation
assistant, [ ] summarization, [ ] basic predictive analytics.

Technical: [x] DB schema, [x] REST APIs (Phase 1 modules), [ ] API docs
(OpenAPI — add `swagger-ui-express` or similar once routes stabilize),
[x] Docker setup, [ ] unit/integration tests, [ ] Git repo (run `git init`
after reviewing `.gitignore`), [x] this README, [ ] deployment docs,
[x] security docs (`docs/SECURITY.md`).
