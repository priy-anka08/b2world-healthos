import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "@/common/middleware/auth.middleware";
import { requireTenant } from "@/common/middleware/tenant.middleware";
import { requirePermission } from "@/common/guards/rbac.guard";
import { writeAuditLog } from "@/common/utils/audit";
import { createInvoice, listInvoices, recordPayment, recordRefund } from "./billing.service";

export const billingRouter = Router();
billingRouter.use(authMiddleware, requireTenant);

billingRouter.get("/invoices", requirePermission("billing", "read"), async (req, res) => {
  res.json(await listInvoices(req.tenantHospitalId!));
});

const lineItemSchema = z.object({
  type: z.enum(["consultation", "lab", "pharmacy", "room", "other"]),
  description: z.string().min(1),
  amount: z.number().positive(),
});

const createSchema = z.object({
  patientId: z.string().uuid(),
  lineItems: z.array(lineItemSchema).min(1),
});

billingRouter.post("/invoices", requirePermission("billing", "create"), async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const invoice = await createInvoice({ hospitalId: req.tenantHospitalId!, ...body });
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "billing.invoice.create",
      resourceId: invoice.id,
    });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["cash", "card", "upi", "insurance"]),
});

billingRouter.post("/invoices/:id/payments", requirePermission("billing", "create"), async (req, res, next) => {
  try {
    const body = paymentSchema.parse(req.body);
    const payment = await recordPayment(req.tenantHospitalId!, req.params.id, body.amount, body.method);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "billing.payment.create",
      resourceId: payment.id,
    });
    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
});

billingRouter.post("/invoices/:id/refunds", requirePermission("billing", "create"), async (req, res, next) => {
  try {
    const body = refundSchema.parse(req.body);
    const refund = await recordRefund(req.tenantHospitalId!, req.params.id, body.amount, body.reason);
    await writeAuditLog({
      hospitalId: req.tenantHospitalId,
      userId: req.auth!.userId,
      action: "billing.refund.create",
      resourceId: refund.id,
    });
    res.status(201).json(refund);
  } catch (err) {
    if (err instanceof Error && "statusCode" in err) {
      return res.status((err as never as { statusCode: number }).statusCode).json({ error: err.message });
    }
    next(err);
  }
});