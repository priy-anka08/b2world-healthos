# B2World HealthOS

AI-powered, multi-tenant hospital operations & intelligence platform.
Scaffolded from the B2World project assignment spec (24-page brief, 6 build
phases, 44 numbered requirements).

This repo is a **working foundation**, not a finished product: Phase 1
(architecture, auth, RBAC, multi-tenancy, admin/onboarding, audit logging)
plus two fully-wired example modules (Patients, Appointments) are real and
runnable. Every other module (Phases 2-6) exists as a properly-placed,
documented stub so the whole system's shape is visible and each piece can be
built independently without redesigning the foundation. See
[`docs/ROADMAP.md`](docs/ROADMAP.md) for the phase-by-phase build order.

## Stack

| Layer          | Choice                                                   |
|----------------|-----------------------------------------------------------|
| Backend        | Node.js + TypeScript + Express + Prisma                  |
| Database       | PostgreSQL + pgvector extension                           |
| Cache/queue    | Redis                                                      |
| Frontend       | React + TypeScript + Vite + Tailwind + React Query        |
| AI service     | Python + FastAPI, self-hosted via Ollama (no paid LLM API required — spec §39) |
| OCR            | PaddleOCR                                                  |
| Speech (later) | faster-whisper                                             |
| Auth           | JWT, hospital-scoped tokens, RBAC via DB-defined permissions |

## Why this structure

- **Multi-tenancy is enforced in code, not just the schema.** Every clinical
  table carries `hospitalId`; `tenant.middleware.ts` derives the trusted
  hospital id from the verified JWT (never from a client-supplied header);
  every module's service layer must filter by it first. See
  `backend/src/common/middleware/tenant.middleware.ts` for the checklist.
- **RBAC is data-driven.** Roles and permissions live in the database
  (`Role`, `Permission`, `RolePermission`), not hardcoded in route files, so
  granting/revoking access doesn't require a deploy.
- **AI is a governed layer, not a shortcut.** Every AI call is meant to be
  logged via `AIRequest`/`AIOutput` (spec §38's flow: User → Auth → Role →
  Permission → Data Scope → AI Service → Response), and AI-generated
  clinical content (documentation drafts, extracted lab values) is never
  auto-committed to the official record without human approval.

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env — at minimum set a real JWT_SECRET

docker compose up -d postgres redis ollama
cd backend
npm install
npx prisma migrate dev --name init
npm run seed
cd ..

docker compose up backend frontend ai-service
```

Then:
- Frontend: http://localhost:5173
- Backend health check: http://localhost:4000/health
- AI service health check: http://localhost:8000/health

### Demo logins (from `backend/seed/seed.ts`)

| Role            | Email                        | Password       |
|-----------------|-------------------------------|-----------------|
| Super Admin     | superadmin@b2world.dev        | ChangeMe!123    |
| Hospital Admin   | admin@demo-hospital.dev       | ChangeMe!123    |

**Change these before any non-local deployment.**

## Running without Docker

```bash
# Postgres + Redis running locally, matching .env
cd backend && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd ../frontend && npm install && npm run dev
cd ../ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## Repository layout

```
backend/            Node/Express/Prisma API
  prisma/schema.prisma   Full data model (spec §40 — 40+ entities)
  src/common/             auth, RBAC guard, tenant middleware, audit, errors
  src/modules/             one folder per feature area
    auth/ organizations/ hospitals/ departments/ users/
    patients/ appointments/ audit/        <- fully implemented (Phase 1)
    staff/ beds/ laboratory/ pharmacy/ inventory/ billing/ assets/ ...
    ai-copilot/ ai-ocr/ ai-rag/ ai-predictions/ subscriptions/  <- stubs, see each README.md
  seed/seed.ts             roles, permissions, demo org/hospital/admin

frontend/            React/Vite/Tailwind app
  src/pages/               one folder per feature area (auth, dashboard done)
  src/context/AuthContext.tsx   login + hospital-selection state
  src/api/client.ts         axios instance with JWT injection

ai-service/          Python/FastAPI self-hosted AI layer
  app/routers/              one stub router per AI feature (documentation,
                              summarization, rag, ocr, predictions, copilot)

docs/                ARCHITECTURE.md, ROADMAP.md, SECURITY.md
docker-compose.yml   postgres(+pgvector), redis, ollama, backend, frontend, ai-service
```

## Implementing the next module (pattern to copy)

Every stub module's `README.md` (e.g. `backend/src/modules/billing/README.md`)
points back to this pattern. In short:

1. Look at `backend/src/modules/patients/` (full CRUD + tenant scoping +
   audit logging + a domain-specific safety check) and
   `backend/src/modules/appointments/` (booking + a computed endpoint).
2. Write `<module>.service.ts`: plain functions, Prisma only, every query
   filtered by `hospitalId` first.
3. Write `<module>.routes.ts`: Express router behind `authMiddleware`,
   `requireTenant`, `requirePermission(resource, action)`.
4. Replace the stub import in `backend/src/app.ts`.
5. Add permission rows for the new resource to `backend/seed/seed.ts` and
   grant them to the right roles.
6. Add a frontend page under `frontend/src/pages/<module>/` and a route in
   `App.tsx`.
7. Write an integration test proving Hospital A cannot read Hospital B's
   data through the new module.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system diagram, AI pipeline, FHIR notes
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — Phase 1-6 checklist mapped to this repo
- [`docs/SECURITY.md`](docs/SECURITY.md) — what's implemented, what's still a TODO before production

## Explicitly out of scope for the MVP scaffold

Per the spec, this is a foundation for a commercial product, not a finished
compliance artifact:

- No claim of HIPAA/DPDP compliance — that depends on the full
  organization, process, and deployment, not just code (spec §37).
- MFA, password-reset flows, and email/SMS delivery are flagged as Phase 1
  hardening TODOs (see comments in `auth.service.ts` / `users.routes.ts`) —
  wire a real provider before going live.
- AI predictions (no-show risk, bed forecasts, maintenance risk, etc.) are
  designed to be advisory signals surfaced with supporting data, never
  autonomous decisions — keep that framing when you implement them.
