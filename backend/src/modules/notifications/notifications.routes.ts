import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { createNotification, listNotifications, markRead } from "./notifications.service";

export const notificationsRouter = Router();
notificationsRouter.use(authMiddleware, requireTenant);

// No requirePermission gate here — every authenticated staff member should
// see their own hospital-wide/personal notifications regardless of role.
notificationsRouter.get("/", async (req, res) => {
  res.json(await listNotifications(req.tenantHospitalId!, req.auth!.userId));
});

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  channel: z.enum(["in_app", "email", "sms"]).default("in_app"),
  userId: z.string().uuid().optional(), // omit to broadcast hospital-wide
});

notificationsRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const notification = await createNotification({ hospitalId: req.tenantHospitalId!, ...body });
    res.status(201).json(notification);
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    const notification = await markRead(req.tenantHospitalId!, req.params.id);
    res.json(notification);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});