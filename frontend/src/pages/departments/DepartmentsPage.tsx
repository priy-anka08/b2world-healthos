import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Department {
  id: string;
  name: string;
  code: string;
}

const emptyForm = { name: "", code: "" };

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: departments, isLoading } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => api.get("/departments").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/departments", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-slate-500 text-sm">{departments?.length ?? 0} departments</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add department"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3"
        >
          <input required placeholder="Department name (e.g. Cardiology)" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Code (e.g. CARD)" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <button type="submit" disabled={createMutation.isPending} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Saving..." : "Save department"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Code</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={2}>Loading...</td></tr>}
            {departments?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={2}>No departments yet.</td></tr>}
            {departments?.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.name}</td>
                <td className="px-4 py-2 text-slate-500">{d.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}