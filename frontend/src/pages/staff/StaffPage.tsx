import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Department {
  id: string;
  name: string;
}
interface StaffMember {
  id: string;
  jobTitle?: string;
  user: { firstName: string; lastName: string; email: string };
  department?: { name: string };
}

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  temporaryPassword: "",
  jobTitle: "",
  departmentId: "",
  role: "NURSE" as const,
};

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: staff, isLoading } = useQuery<StaffMember[]>({
    queryKey: ["staff"],
    queryFn: () => api.get("/staff").then((r) => r.data),
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => api.get("/departments").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post("/staff", { ...payload, departmentId: payload.departmentId || undefined }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Failed to add staff member");
    },
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
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-slate-500 text-sm">{staff?.length ?? 0} staff members</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add staff"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input required type="email" placeholder="Email" className="border rounded-lg px-3 py-2 col-span-2"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input required placeholder="First name" className="border rounded-lg px-3 py-2"
              value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input required placeholder="Last name" className="border rounded-lg px-3 py-2"
              value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <input required type="password" placeholder="Temporary password" className="border rounded-lg px-3 py-2 col-span-2"
              value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} />
            <select className="border rounded-lg px-3 py-2" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}>
              <option value="NURSE">Nurse</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="PHARMACIST">Pharmacist</option>
              <option value="LAB_TECHNICIAN">Lab Technician</option>
              <option value="ACCOUNTANT">Accountant</option>
            </select>
            <select className="border rounded-lg px-3 py-2" value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">No department</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input placeholder="Job title" className="border rounded-lg px-3 py-2 col-span-2"
              value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
          </div>
          <button type="submit" disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Saving..." : "Save staff member"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Job title</th>
              <th className="px-4 py-2">Department</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td></tr>}
            {staff?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No staff yet.</td></tr>}
            {staff?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.user.firstName} {s.user.lastName}</td>
                <td className="px-4 py-2">{s.user.email}</td>
                <td className="px-4 py-2">{s.jobTitle ?? "—"}</td>
                <td className="px-4 py-2">{s.department?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}