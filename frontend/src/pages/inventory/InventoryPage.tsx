import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Batch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  supplierId?: string | null;
}
interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  reorderLevel: number;
  currentStock: number;
  batches: Batch[];
}
interface ExpiringBatch {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  item: { name: string; unit: string };
  supplier?: { name: string } | null;
}

const emptyForm = { name: "", category: "consumable", unit: "unit", reorderLevel: 10, currentStock: 0 };
const emptyBatch = { batchNumber: "", quantity: 0, expiryDate: "" };

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [batchFormFor, setBatchFormFor] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [error, setError] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["inventory-items"],
    queryFn: () => api.get("/inventory").then((r) => r.data),
  });

  const { data: expiring } = useQuery<ExpiringBatch[]>({
    queryKey: ["inventory-expiring"],
    queryFn: () => api.get("/inventory/expiring?days=30").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/inventory", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Failed to add item");
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.post(`/inventory/${id}/adjust-stock`, { delta }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
  });

  const batchMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof batchForm }) =>
      api.post(`/inventory/${id}/batches`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-expiring"] });
      setBatchFormFor(null);
      setBatchForm(emptyBatch);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-slate-500 text-sm">
            General hospital stock — consumables, equipment parts, and batch/expiry tracking.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

      {expiring && expiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold text-amber-900 text-sm mb-2">Expiring within 30 days</h2>
          <ul className="text-sm text-amber-800 space-y-1">
            {expiring.map((b) => (
              <li key={b.id}>
                {b.item.name} — batch {b.batchNumber} ({b.quantity} {b.item.unit}), expires{" "}
                {new Date(b.expiryDate).toLocaleDateString()}
                {b.supplier?.name ? ` — ${b.supplier.name}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            createMutation.mutate(form);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg"
        >
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Item name"
              className="border rounded-lg px-3 py-2 col-span-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <select
              className="border rounded-lg px-3 py-2"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="consumable">Consumable</option>
              <option value="equipment_part">Equipment part</option>
              <option value="medicine">Medicine</option>
            </select>
            <input
              required
              placeholder="Unit (e.g. box, piece)"
              className="border rounded-lg px-3 py-2"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
            <input
              type="number"
              min={0}
              placeholder="Reorder level"
              className="border rounded-lg px-3 py-2"
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
            />
            <input
              type="number"
              min={0}
              placeholder="Initial stock"
              className="border rounded-lg px-3 py-2"
              value={form.currentStock}
              onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving..." : "Save item"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2">Batches</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>Loading...</td>
              </tr>
            )}
            {items?.length === 0 && !isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>No items yet.</td>
              </tr>
            )}
            {items?.map((item) => (
              <>
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2 capitalize">{item.category.replace("_", " ")}</td>
                  <td className="px-4 py-2">
                    <span className={item.currentStock <= item.reorderLevel ? "text-amber-700 font-medium" : "text-slate-700"}>
                      {item.currentStock} {item.unit}
                    </span>
                    {item.currentStock <= item.reorderLevel && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">Low stock</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{item.batches.length}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => adjustMutation.mutate({ id: item.id, delta: 10 })}
                      className="text-xs text-green-700 underline"
                    >
                      +10
                    </button>
                    <button
                      onClick={() => adjustMutation.mutate({ id: item.id, delta: -1 })}
                      disabled={item.currentStock <= 0}
                      className="text-xs text-red-700 underline disabled:opacity-40"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => setBatchFormFor(batchFormFor === item.id ? null : item.id)}
                      className="text-xs text-blue-700 underline"
                    >
                      + Batch
                    </button>
                  </td>
                </tr>
                {batchFormFor === item.id && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="flex gap-2 items-end flex-wrap">
                        <input
                          placeholder="Batch number"
                          className="border rounded px-2 py-1 text-sm"
                          value={batchForm.batchNumber}
                          onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Quantity"
                          className="border rounded px-2 py-1 text-sm w-24"
                          value={batchForm.quantity}
                          onChange={(e) => setBatchForm({ ...batchForm, quantity: Number(e.target.value) })}
                        />
                        <input
                          type="date"
                          className="border rounded px-2 py-1 text-sm"
                          value={batchForm.expiryDate}
                          onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                        />
                        <button
                          onClick={() => batchMutation.mutate({ id: item.id, payload: batchForm })}
                          disabled={!batchForm.batchNumber || !batchForm.quantity || !batchForm.expiryDate}
                          className="bg-slate-900 text-white rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                        >
                          Add batch
                        </button>
                      </div>
                      {item.batches.length > 0 && (
                        <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
                          {item.batches.map((b) => (
                            <li key={b.id}>
                              {b.batchNumber} — {b.quantity} {item.unit}, expires {new Date(b.expiryDate).toLocaleDateString()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}