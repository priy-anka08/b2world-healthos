import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
}

interface PurchaseOrder {
  id: string;
  status: string;
  totalAmount: string;
  supplier: { name: string };
  createdAt: string;
}

const emptySupplierForm = { name: "", contact: "", email: "" };
const emptyPoForm = { supplierId: "", totalAmount: 0 };

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [showPoForm, setShowPoForm] = useState(false);
  const [poForm, setPoForm] = useState(emptyPoForm);

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: () => api.get("/suppliers").then((r) => r.data),
  });

  const { data: purchaseOrders, isLoading: posLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get("/suppliers/purchase-orders").then((r) => r.data),
  });

  const createSupplier = useMutation({
    mutationFn: (payload: typeof supplierForm) => api.post("/suppliers", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSupplierForm(emptySupplierForm);
      setShowSupplierForm(false);
    },
  });

  const createPo = useMutation({
    mutationFn: (payload: typeof poForm) => api.post("/suppliers/purchase-orders", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setPoForm(emptyPoForm);
      setShowPoForm(false);
    },
  });

  const setPoStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/suppliers/purchase-orders/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Suppliers &amp; Purchase Orders</h1>
          <p className="text-slate-500 text-sm">{suppliers?.length ?? 0} suppliers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSupplierForm((v) => !v)} className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium">
            {showSupplierForm ? "Cancel" : "+ Add supplier"}
          </button>
          <button onClick={() => setShowPoForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
            {showPoForm ? "Cancel" : "+ New purchase order"}
          </button>
        </div>
      </div>

      {showSupplierForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSupplier.mutate(supplierForm);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg"
        >
          <input required placeholder="Supplier name" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
          <input placeholder="Contact number" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={supplierForm.contact} onChange={(e) => setSupplierForm({ ...supplierForm, contact: e.target.value })} />
          <input placeholder="Email" type="email" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
          <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
            Save supplier
          </button>
        </form>
      )}

      {showPoForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPo.mutate(poForm);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg"
        >
          <select required className="w-full border rounded-lg px-3 py-2 text-sm" value={poForm.supplierId}
            onChange={(e) => setPoForm({ ...poForm, supplierId: e.target.value })}>
            <option value="">Select supplier…</option>
            {suppliers?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input required type="number" min={0} placeholder="Total amount (₹)" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={poForm.totalAmount || ""} onChange={(e) => setPoForm({ ...poForm, totalAmount: Number(e.target.value) })} />
          {!suppliers?.length && <p className="text-xs text-amber-600">Add a supplier first.</p>}
          <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
            Create purchase order
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-2 border-b bg-slate-50 text-sm font-medium">Suppliers</div>
        <table className="w-full text-sm">
          <tbody>
            {suppliersLoading && <tr><td className="px-4 py-4 text-slate-400">Loading...</td></tr>}
            {suppliers?.length === 0 && !suppliersLoading && <tr><td className="px-4 py-4 text-slate-400">No suppliers yet.</td></tr>}
            {suppliers?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 text-slate-500">{s.contact ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{s.email ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50 text-sm font-medium">Purchase Orders</div>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {posLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td></tr>}
            {purchaseOrders?.length === 0 && !posLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No purchase orders yet.</td></tr>}
            {purchaseOrders?.map((po) => (
              <tr key={po.id} className="border-t">
                <td className="px-4 py-2">{po.supplier.name}</td>
                <td className="px-4 py-2">₹{Number(po.totalAmount).toFixed(2)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs rounded-full px-2 py-1 ${statusColor[po.status]}`}>{po.status}</span>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={po.status}
                    onChange={(e) => setPoStatus.mutate({ id: po.id, status: e.target.value })}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}