# Security Notes

No compliance claim is made here. HIPAA/DPDP-style compliance depends on the
full organization, processes, contracts, and deployment environment — not
just code (spec §37). This document tracks what the scaffold implements and
what must be added before any real deployment.

## Implemented
- JWT auth, hospital-scoped tokens
- RBAC via DB-defined roles/permissions, checked per-request
- Multi-tenant isolation enforced in middleware + every query
- Audit logging (`AuditLog`) on auth + patient + hospital/user actions
- Helmet (secure headers), CORS allow-list, rate limiting
- Passwords hashed with bcrypt (cost 12)
- No secrets in code — all via `.env` (see `.gitignore`)

## Required before production (not yet built)
- [ ] MFA for privileged accounts (Hospital Admin, Doctor, Accountant, Super Admin)
- [ ] Password reset + forced reset on first login (currently temp passwords are set directly by an admin)
- [ ] Encryption at rest for the database volume + backups
- [ ] TLS termination (put a reverse proxy / load balancer in front of `backend`/`frontend`)
- [ ] Secure file storage for uploads (S3-compatible with private ACLs, not local disk)
- [ ] Consent management UI (schema has `PatientConsent`, no endpoints yet)
- [ ] Data export controls / right-to-access tooling
- [ ] Session/token revocation list (JWTs are currently valid until expiry even if a user is deactivated mid-session)
- [ ] Dependency scanning + secret scanning in CI
- [ ] Backup and disaster-recovery runbook
- [ ] Penetration test before handling real patient data

## Tenant-isolation testing requirement

Every new module must ship with at least one integration test proving a
user authenticated for Hospital A gets a 404 (not a 200 with someone else's
data) when requesting a Hospital B resource by id. This is the single
highest-value test in the whole system given spec §36 explicitly calls
cross-tenant access a hard requirement to prevent.

## AI-specific security (spec §38)

- Every AI feature must log an `AIRequest` (who, when, what data scope,
  which feature) before calling the AI service.
- AI-generated clinical content (documentation drafts, extracted lab
  values) must never write to the official record without a human
  `approvedByUserId` on the corresponding row.
- The AI service (`ai-service/`) must never be exposed on a public port —
  it trusts the backend to have already authenticated and scoped the
  request.
