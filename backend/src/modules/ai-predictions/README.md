# Ai Predictions module

**Status:** stub (not yet implemented)
**Roadmap phase:** Phase 5

## What this module owns

No-show prediction, bed forecasting, inventory prediction, revenue anomaly detection, staff scheduling, equipment risk (spec sections 14-16, 18-19, 24-27, 29). All predictions are advisory, never authoritative.

## How to implement it

1. Copy the pattern from `backend/src/modules/patients/` (full CRUD + tenant
   scoping + audit logging + duplicate-check style validation) or
   `backend/src/modules/appointments/` (booking + a computed/derived
   endpoint like the queue estimate).
2. Create `ai-predictions.service.ts` — plain async functions, Prisma only, no
   Express types. Every query's first `where` key must be `hospitalId`.
3. Create `ai-predictions.routes.ts` — an Express router mounted behind
   `authMiddleware`, `requireTenant`, and `requirePermission("ai_predictions", action)`.
4. Register the real router in `backend/src/app.ts`, replacing the stub
   import.
5. Add the relevant `Permission` rows to `backend/seed/seed.ts` (resource =
   `"ai_predictions"`) and grant them to the roles that should have
   access.
6. Write at least one integration test asserting a user from Hospital A
   cannot read/write Hospital B's data through this module.

## Relevant Prisma models

See `backend/prisma/schema.prisma`.
