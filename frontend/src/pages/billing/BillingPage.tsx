import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
}

interface Invoice {
  id: string;
  totalAmount: string;
  status: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; patientCode: string };
  payments: { amount: string; method: string }[];
  refunds: { amount: string; reason?: string }[];
  lineItems: { type: string; description: string; amount: number }[];
}

const emptyLineItem = { type: "consultation" as const, description: "", amount: 0 };
const emptyForm = { patientId: "", lineItems: [emptyLineItem] };

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [refundingInvoice, setRefundingInvoice] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => api.get("/billing/invoices").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/billing/invoices", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Failed to create invoice");
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      api.post(`/billing/invoices/${id}/payments`, { amount, method: "cash" }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setPayingInvoice(null);
      setPaymentAmount(0);
    },
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, amount, reason }: { id: string; amount: number; reason?: string }) =>
      api.post(`/billing/invoices/${id}/refunds`, { amount, reason }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setRefundingInvoice(null);
      setRefundAmount(0);
      setRefundReason("");
    },
  });

  function updateLineItem(idx: number, field: keyof typeof emptyLineItem, value: string | number) {
    const items = [...form.lineItems];
    items[idx] = { ...items[idx], [field]: value };
    setForm({ ...form, lineItems: items });
  }

  function addLineItem() {
    setForm({ ...form, lineItems: [...form.lineItems, { ...emptyLineItem }] });
  }

  function removeLineItem(idx: number) {
    setForm({ ...form, lineItems: form.lineItems.filter((_, i) => i !== idx) });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(form);
  }

  const total = form.lineItems.reduce((sum, li) => sum + Number(li.amount || 0), 0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-slate-500 text-sm">{invoices?.length ?? 0} invoices</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ New invoice"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-2xl">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <select required className="w-full border rounded-lg px-3 py-2" value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
            <option value="">Select patient…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientCode})</option>
            ))}
          </select>

          <div className="space-y-2">
            {form.lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select className="col-span-3 border rounded-lg px-2 py-2 text-sm" value={li.type}
                  onChange={(e) => updateLineItem(idx, "type", e.target.value)}>
                  <option value="consultation">Consultation</option>
                  <option value="lab">Lab</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="room">Room</option>
                  <option value="other">Other</option>
                </select>
                <input required placeholder="Description" className="col-span-6 border rounded-lg px-2 py-2 text-sm"
                  value={li.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} />
                <input required type="number" min={0} placeholder="₹" className="col-span-2 border rounded-lg px-2 py-2 text-sm"
                  value={li.amount || ""} onChange={(e) => updateLineItem(idx, "amount", Number(e.target.value))} />
                <button type="button" onClick={() => removeLineItem(idx)} disabled={form.lineItems.length === 1}
                  className="col-span-1 text-red-600 text-sm disabled:opacity-30">✕</button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addLineItem} className="text-sm text-blue-600 underline">+ Add line item</button>
          <div className="text-right font-medium">Total: ₹{total.toFixed(2)}</div>
          <button type="submit" disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Creating..." : "Create invoice"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td></tr>}
            {invoices?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No invoices yet.</td></tr>}
            {invoices?.map((inv) => {
              const totalRefunded = inv.refunds.reduce((s, r) => s + Number(r.amount), 0);
              return (
                <tr key={inv.id} className="border-t align-top">
                  <td className="px-4 py-2">{inv.patient.firstName} {inv.patient.lastName}</td>
                  <td className="px-4 py-2">
                    ₹{Number(inv.totalAmount).toFixed(2)}
                    {totalRefunded > 0 && <div className="text-xs text-red-600">−₹{totalRefunded.toFixed(2)} refunded</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs rounded-full px-2 py-1 ${
                        inv.status === "paid" ? "bg-green-100 text-green-800"
                        : inv.status === "partial" ? "bg-amber-100 text-amber-800"
                        : inv.status === "refunded" ? "bg-slate-200 text-slate-700"
                        : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-y-2">
                    {inv.status !== "paid" && inv.status !== "refunded" && (
                      payingInvoice === inv.id ? (
                        <div className="flex gap-2 items-center">
                          <input type="number" min={0} className="border rounded px-2 py-1 w-20 text-xs"
                            value={paymentAmount || ""} onChange={(e) => setPaymentAmount(Number(e.target.value))} />
                          <button onClick={() => paymentMutation.mutate({ id: inv.id, amount: paymentAmount })}
                            className="text-xs bg-slate-900 text-white rounded px-2 py-1">Pay (cash)</button>
                        </div>
                      ) : (
                        <button onClick={() => { setPayingInvoice(inv.id); setPaymentAmount(Number(inv.totalAmount)); }}
                          className="text-xs text-blue-600 underline block">Record payment</button>
                      )
                    )}
                    {inv.payments.length > 0 && inv.status !== "refunded" && (
                      refundingInvoice === inv.id ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2 items-center">
                            <input type="number" min={0} className="border rounded px-2 py-1 w-20 text-xs"
                              value={refundAmount || ""} onChange={(e) => setRefundAmount(Number(e.target.value))} />
                            <input placeholder="Reason" className="border rounded px-2 py-1 w-28 text-xs"
                              value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
                          </div>
                          <button
                            onClick={() => refundMutation.mutate({ id: inv.id, amount: refundAmount, reason: refundReason || undefined })}
                            className="text-xs bg-red-700 text-white rounded px-2 py-1 self-start"
                          >
                            Confirm refund
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setRefundingInvoice(inv.id)} className="text-xs text-red-600 underline block">
                          Issue refund
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}