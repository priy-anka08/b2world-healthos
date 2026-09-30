# B2World HealthOS

AI-powered, multi-tenant hospital operations & intelligence platform.
Built against a 24-page project spec (6 build phases, 44 numbered
requirements) for B2World (BTOW Pvt. Ltd.).

**Status: ~85-90% complete.** Core hospital management, RBAC/multi-tenancy,
all major clinical/operational modules, billing, reporting, notifications,
patient portal, FHIR-lite, MFA, and the full self-hosted AI layer (OCR,
RAG, Copilot, predictions, voice, multi-agent orchestrator) are built and
tested. Remaining work is polish: broader UI coverage on a few pages,
production deployment, and a security/error-handling pass — see
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

| Layer          | Choice                                                                          |
|----------------|----------------------------------------------------------------------------------|
| Backend        | Node.js + TypeScript + Express + Prisma                                          |
| Database       | PostgreSQL + pgvector extension                                                  |
| Cache/queue    | Redis                                                                             |
| Frontend       | React + TypeScript + Vite + Tailwind + React Query                               |
| AI service     | Python + FastAPI, self-hosted via Ollama (no paid LLM API required — spec §39)   |
| OCR            | PaddleOCR                                                                         |
| Speech         | faster-whisper                                                                   |
| Auth           | JWT (hospital-scoped tokens), RBAC via DB-defined permissions, TOTP MFA           |
| API docs       | OpenAPI/Swagger at `/api/docs`                                                    |
| Tests          | Vitest (backend)                                                                  |

## What's built

**Core:** Auth (login, MFA, self-service password reset, session revocation),
multi-tenancy, RBAC, hospital onboarding, audit logging, patients (with
duplicate detection), practitioners/staff, appointments, departments.

**Operations:** Beds/wards/rooms, pharmacy, general inventory (batch +
expiry tracking), suppliers/purchase orders, billing (invoices, payments,
refunds), laboratory (orders → results → review), assets (with predictive
maintenance risk scoring).

**AI (self-hosted, Ollama + PaddleOCR + faster-whisper):**
- Documentation assistant, clinical summarization, hospital RAG assistant
- Document OCR pipeline (classification + field extraction + human verification)
- Voice assistant (transcription → read-only Copilot query)
- HealthOS Copilot (natural-language ops questions)
- Multi-agent orchestrator (Operations/Finance/Inventory agents)
- Predictive analytics: bed occupancy, inventory reorder/anomaly, revenue
  analytics/anomaly, lab turnaround, appointment no-show risk, equipment
  maintenance risk

**Governance & compliance building blocks:** every AI call is logged via
`AIRequest`/`AIOutput` with a human-approval flag; patient consent tracking;
patient data export; FHIR-shaped resource mapping; subscription seat-limit
enforcement.

**Not yet built:** white-label theming, real email delivery (password
reset currently returns the token directly in dev mode), production
deployment.

## Quick start (Docker)

```powershell
cp .env.example .env
# edit .env — at minimum set a real JWT_SECRET

docker compose up -d --build backend ai-service frontend
docker compose exec backend npm run seed
docker compose exec ollama ollama pull llama3.1:8b
docker compose exec backend npm run test
```

Then open:
- Frontend: http://localhost:5173
- API docs: http://localhost:4000/api/docs
- AI service health: http://localhost:8000/health

**Demo login:**