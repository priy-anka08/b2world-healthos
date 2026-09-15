import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { createSubscription, listSubscriptions, setSubscriptionStatus } from "./subscriptions.service";

export const subscriptionsRouter = Router();
subscriptionsRouter.use(authMiddleware);

// Platform-level (cross-hospital) resource — super admin only, same
// pattern as organizations.routes.ts. Deliberately does NOT use
// requireTenant, since this isn't scoped to any single hospital.
function requireSuperAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!req.auth?.isSuperAdmin) return res.status(403).json({ error: "Super admin only" });
  next();
}
subscriptionsRouter.use(requireSuperAdmin);

subscriptionsRouter.get("/", async (_req, res) => {
  res.json(await listSubscriptions());
});

const createSchema = z.object({
  organizationId: z.string().uuid(),
  planName: z.string().min(1),
  seatLimit: z.number().int().positive().optional(),
  currentPeriodEnd: z.coerce.date().optional(),
});

subscriptionsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const sub = await createSubscription(body);
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.post("/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.string() }).parse(req.body);
    const sub = await setSubscriptionStatus(req.params.id, status);
    res.json(sub);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});