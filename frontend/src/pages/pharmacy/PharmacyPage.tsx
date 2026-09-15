import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  reorderLevel: number;
  currentStock: number;
}

const emptyForm = { name: "", category: "medicine", unit: "tablet", reorderLevel: 10, currentStock: 0 };

export default function PharmacyPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: () => api.get("/pharmacy").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/pharmacy", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
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
      api.post(`/pharmacy/${id}/adjust-stock`, { delta }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(form);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pharmacy / Inventory</h1>
          <p className="text-slate-500 text-sm">{items?.length ?? 0} items</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
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
              <option value="medicine">Medicine</option>
              <option value="consumable">Consumable</option>
              <option value="equipment_part">Equipment part</option>
            </select>
            <input
              required
              placeholder="Unit (e.g. tablet, box)"
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
              <th className="px-4 py-2">Reorder level</th>
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
              <tr key={item.id} className="border-t">
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 capitalize">{item.category.replace("_", " ")}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      item.currentStock <= item.reorderLevel
                        ? "text-amber-700 font-medium"
                        : "text-slate-700"
                    }
                  >
                    {item.currentStock} {item.unit}
                  </span>
                  {item.currentStock <= item.reorderLevel && (
                    <span className="ml-2 text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                      Low stock
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{item.reorderLevel}</td>
                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => adjustMutation.mutate({ id: item.id, delta: 10 })}
                    className="text-xs text-green-700 underline"
                  >
                    +10 restock
                  </button>
                  <button
                    onClick={() => adjustMutation.mutate({ id: item.id, delta: -1 })}
                    disabled={item.currentStock <= 0}
                    className="text-xs text-red-700 underline disabled:opacity-40"
                  >
                    -1 dispense
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}