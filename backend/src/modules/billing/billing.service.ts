import { prisma } from "@/config/prisma";

interface LineItem {
  type: "consultation" | "lab" | "pharmacy" | "room" | "other";
  description: string;
  amount: number;
}

interface CreateInvoiceInput {
  hospitalId: string;
  patientId: string;
  lineItems: LineItem[];
}

export async function listInvoices(hospitalId: string) {
  return prisma.invoice.findMany({
    where: { hospitalId },
    include: {
      patient: { select: { firstName: true, lastName: true, patientCode: true } },
      payments: true,
      refunds: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function createInvoice(input: CreateInvoiceInput) {
  const totalAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);
  return prisma.invoice.create({
    data: {
      hospitalId: input.hospitalId,
      patientId: input.patientId,
      lineItems: input.lineItems as never,
      totalAmount,
    },
  });
}

export async function recordPayment(hospitalId: string, invoiceId: string, amount: number, method: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, hospitalId },
    include: { payments: true },
  });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });

  const alreadyPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const newTotal = alreadyPaid + amount;

  const payment = await prisma.payment.create({
    data: { invoiceId, amount, method },
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: newTotal >= Number(invoice.totalAmount) ? "paid" : "partial",
    },
  });

  return payment;
}

// Refunds (spec's billing entity list includes Refund). A refund can be
// partial; it doesn't automatically flip the invoice back to "unpaid" —
// that judgment call is left to the accountant, since a partial refund on
// an otherwise-settled invoice is a normal, expected scenario.
export async function recordRefund(hospitalId: string, invoiceId: string, amount: number, reason?: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, hospitalId },
    include: { payments: true, refunds: true },
  });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalRefunded = invoice.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
  if (amount > totalPaid - totalRefunded) {
    throw Object.assign(new Error("Refund amount exceeds amount available to refund"), { statusCode: 409 });
  }

  const refund = await prisma.refund.create({
    data: { invoiceId, amount, reason },
  });

  if (totalRefunded + amount >= totalPaid) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "refunded" } });
  }

  return refund;
}