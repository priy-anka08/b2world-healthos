# Reports module

**Status:** stub (not yet implemented)
**Roadmap phase:** Phase 3/6

## What this module owns

Cross-module reporting/export (operational + financial). Reads from existing modules, no new core model.

## How to implement it

1. Copy the pattern from `backend/src/modules/patients/` (full CRUD + tenant
   scoping + audit logging + duplicate-check style validation) or
   `backend/src/modules/appointments/` (booking + a computed/derived
   endpoint like the queue estimate).
2. Create `reports.service.ts` — plain async functions, Prisma only, no
   Express types. Every query's first `where` key must be `hospitalId`.
3. Create `reports.routes.ts` — an Express router mounted behind
   `authMiddleware`, `requireTenant`, and `requirePermission("reports", action)`.
4. Register the real router in `backend/src/app.ts`, replacing the stub
   import.
5. Add the relevant `Permission` rows to `backend/seed/seed.ts` (resource =
   `"reports"`) and grant them to the roles that should have
   access.
6. Write at least one integration test asserting a user from Hospital A
   cannot read/write Hospital B's data through this module.

## Relevant Prisma models

See `backend/prisma/schema.prisma`.
