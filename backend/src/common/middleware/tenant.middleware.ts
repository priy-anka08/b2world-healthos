import { Request, Response, NextFunction } from "express";

/**
 * Multi-tenancy enforcement (spec §36 — "mandatory").
 *
 * Rule: every module's Prisma queries MUST include `hospitalId: req.tenantHospitalId`
 * in their `where` clause. This middleware does not do that filtering itself
 * (Prisma queries live in each module's service) — its job is to make the
 * *authorized* hospital id available in one trusted place, derived only from
 * the verified JWT, never from a client-supplied header/body/query param.
 *
 * Super Admins operate across hospitals (platform analytics, onboarding) —
 * for those routes, mount a *different* middleware (superAdminOnly) instead
 * of this one, and pass hospitalId explicitly + audited.
 *
 * Enforcement checklist for every new module:
 *   1. Route uses `requireTenant` before the handler.
 *   2. Service function's first Prisma `where` key is `hospitalId`.
 *   3. Any nested `include`/relation queries are also scoped or rely on FK
 *      ownership already scoped by the parent row.
 *   4. Integration test: user from Hospital A requests Hospital B's resource
 *      id directly by URL → expect 404, not 200 with someone else's data.
 */
export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ error: "Unauthenticated" });
  }
  if (req.auth.isSuperAdmin) {
    // Super admins must use explicit, audited hospital-scoped endpoints —
    // block them here so nobody accidentally builds an unscoped query path.
    return res.status(403).json({
      error: "Super admin must use platform-level endpoints, not tenant endpoints",
    });
  }
  if (!req.auth.hospitalId) {
    return res.status(403).json({ error: "No hospital context on this session" });
  }
  req.tenantHospitalId = req.auth.hospitalId;
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantHospitalId?: string;
    }
  }
}
