# Architecture

## System overview

```
                     ┌────────────────────┐
                     │   Frontend (React) │
                     └─────────┬──────────┘
                               │ HTTPS + JWT
                     ┌─────────▼──────────┐
                     │  Backend (Express) │  auth, RBAC, tenant isolation,
                     │                    │  audit logging, all core CRUD
                     └───┬─────────────┬──┘
                         │             │
              ┌──────────▼───┐   ┌─────▼──────────┐
              │  PostgreSQL   │   │   AI Service    │
              │  (+ pgvector) │   │   (FastAPI)     │
              └───────────────┘   └────┬───────────┘
                                        │
                                 ┌──────▼──────┐
                                 │   Ollama    │  local LLM, no paid API
                                 └─────────────┘
```

The backend is the only thing the frontend talks to. The AI service is
internal-only (not exposed publicly) and trusts the backend to have already
done authentication, RBAC, and tenant scoping before it ever sees a request
— this mirrors spec §38's required flow:

```
User → Authentication → Role → Permission → Data Scope → AI Service → Response
```

## Multi-tenancy (spec §36 — mandatory)

```
B2World HealthOS
 ├── Hospital A → Patients, Doctors, Finance, ...
 ├── Hospital B → Patients, Doctors, Finance, ...
 └── Hospital C → Patients, Doctors, Finance, ...
```

Enforced at two layers:
1. **Schema**: every operational table has `hospitalId`.
2. **Code**: `tenant.middleware.ts` puts the *authenticated* hospital id on
   `req.tenantHospitalId`, derived only from the verified JWT. Every
   module's service functions filter by it. This is the layer that actually
   matters — a schema column with no enforced `WHERE` clause is not
   isolation.

Super Admin routes are intentionally blocked from using tenant-scoped
middleware at all (see `requireTenant`), so there's no code path where a
"super admin bypass" accidentally becomes a "any hospital's data" bypass —
platform-level endpoints must query explicitly and audit every access.

## RBAC

`Role` ←→ `Permission` via `RolePermission`, seeded in `backend/seed/seed.ts`.
A user's role is **per hospital** (`UserHospital`), so the same person can be
a Doctor at Hospital A and have no access at all to Hospital B. The active
role is baked into the JWT at login (or hospital-selection) time, but the
actual permission check re-queries the DB per request — so revoking a
permission takes effect immediately, not at next token refresh.

## AI pipeline shapes (from the spec)

**RAG assistant (§13-14):**
```
Hospital Documents → Parser/OCR → Chunking → Embeddings → pgvector →
Retriever → LLM → Answer + Source References
```

**OCR pipeline (§12, §21):**
```
Document → OCR (PaddleOCR) → Classification → Extraction →
Structured Data → Human Verification → Patient Record
```

**AI governance (§38):** every AI call should produce an `AIRequest` row
(who/when/what data scope/which feature) and, where the AI produced content,
an `AIOutput` row that may require `approvedByUserId` before it's trusted
(e.g. a documentation draft, an extracted lab value).

## FHIR compatibility (spec §35)

Not implemented in the scaffold, but the schema is shaped to make it
straightforward: `Patient`, `Practitioner`, `Organization`, `Appointment`,
`Encounter`, `Observation`, `DiagnosticReport`, `MedicationRequest`, and
`AllergyIntolerance`-equivalent data (`Patient.allergies`) all exist as
named concepts already. A FHIR-facade layer (e.g. `/fhir/Patient/:id`
returning a FHIR-shaped JSON view over the existing `Patient` model) is the
natural Phase 3+/6 addition — don't restructure the core schema for it,
translate at the API boundary instead.

## Why Express instead of a heavier framework

The spec cares about clean, modular, testable code more than a specific
framework. Express + a consistent module pattern (service/routes split,
shared guards/middleware) gets there without extra ceremony. If the team
prefers NestJS's built-in DI/decorators, the module boundaries here map
directly onto Nest modules — it's a mechanical port, not a redesign.
