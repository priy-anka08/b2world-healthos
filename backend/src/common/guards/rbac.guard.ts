import { Request, Response, NextFunction } from "express";
import { prisma } from "@/config/prisma";

/**
 * Usage: router.post("/patients", authMiddleware, requireTenant,
 *                     requirePermission("patients", "create"), handler)
 *
 * Checks the caller's role (from the JWT, i.e. their role at the currently
 * active hospital) against the permissions table. Permissions are looked up
 * per-request rather than cached in the JWT so that revoking a permission
 * takes effect immediately without waiting for token expiry.
 */
export function requirePermission(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Unauthenticated" });
    if (req.auth.isSuperAdmin) return next(); // platform-level bypass, still audited downstream

    if (!req.auth.role) {
      return res.status(403).json({ error: "No role on this session" });
    }

    const allowed = await prisma.rolePermission.findFirst({
      where: {
        role: { name: req.auth.role as never },
        permission: { resource, action },
      },
    });

    if (!allowed) {
      return res.status(403).json({
        error: `Missing permission: ${resource}:${action}`,
      });
    }

    next();
  };
}
