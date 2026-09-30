# Security Overview — B2World HealthOS

This document describes the security controls actually implemented in this
codebase, mapped to spec §37. **This is a description of building blocks,
not a compliance certification** — HIPAA/DPDP compliance depends on the
full deployment, organizational processes, and contracts around this
system, not on any single feature.

## Authentication & session management
- Passwords hashed with bcrypt (cost factor 12)
- JWT-based sessions, hospital-scoped (`hospitalId` baked into the token)
- MFA (TOTP, via `otplib`) available for any account, enforced at login
- Session revocation: deactivating a user writes a Redis deny-list entry,
  checked on every request in `auth.middleware.ts`
- Self-service password reset: stateless signed JWT, 15-minute expiry,
  auto-invalidated the moment the password changes (fingerprint check) —
  no separate token table to leak or clean up

## Access control
- RBAC is data-driven — roles and permissions live in `Role`/`Permission`/
  `RolePermission` tables, not hardcoded in route files
- Every hospital-scoped route runs through `requireTenant` (derives the
  trusted hospital id from the verified JWT — never from a client header)
  and `requirePermission(resource, action)`
- Super admin bypasses permission checks by design (platform operator),
  but every other role is checked against the DB on every request

## Rate limiting
- App-wide: 2000 requests / 15 min per IP
- Auth-specific (login, MFA verification, password-reset requests,
  patient self-registration): 10 requests / 15 min per IP — brute-force
  and enumeration protection

## Input validation
- Every request body is validated with `zod` schemas before touching the
  database — no raw `req.body` field is ever passed to Prisma
- Prisma parameterizes all queries — no raw SQL string concatenation
  anywhere in the codebase

## Audit logging
- Every sensitive action (patient view/create/export, AI OCR extract/verify,
  user invite/deactivate, branding changes, login) writes an `AuditLog` row
  with who/when/what

## AI governance (spec §38)
- Every AI call is logged via `AIRequest`/`AIOutput`, tied to the
  requesting user, hospital, and feature
- AI-generated clinical content (documentation drafts, OCR extractions)
  carries `requiresApproval: true` and is never written to the official
  record without an explicit human verification step
- The multi-agent orchestrator and voice assistant are both strictly
  read-only — no agent can create, update, or delete anything

## Data protection
- `pino-http` redacts the `Authorization` header from all logs
- The global error handler never leaks stack traces to API responses
- Patient consent tracking (`PatientConsent`) and a full data-export
  endpoint (`GET /patients/:id/export`) exist as building blocks for
  data-subject-access requests

## Multi-tenancy
- Every clinical table carries `hospitalId`; isolation is enforced at the
  Prisma query layer in every service function, not just the frontend —
  Hospital A's staff literally cannot construct a request that returns
  Hospital B's rows

## What is NOT yet in place
- **Encryption at rest**: relies on the hosting provider's disk encryption
  (e.g. Render/Supabase managed Postgres) — not something this application
  layer implements itself
- **Backup and recovery**: see `DEPLOYMENT.md` — relies on the managed
  Postgres provider's backup feature, not a custom backup job in this repo
- **Real email delivery**: password reset currently returns the token in
  the API response for local testing; production needs an email provider
  wired in before this is safe to expose publicly
- **Formal penetration testing / third-party security audit**: not done