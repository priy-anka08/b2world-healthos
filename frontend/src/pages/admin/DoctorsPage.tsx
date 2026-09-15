import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  temporaryPassword: "",
  specialization: "",
  licenseNumber: "",
};

export default function DoctorsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: practitioners, isLoading } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => api.get("/practitioners").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/practitioners", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practitioners"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Failed to add doctor");
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
          <h1 className="text-2xl font-bold">Doctors</h1>
          <p className="text-slate-500 text-sm">{practitioners?.length ?? 0} practitioners</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add doctor"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="email"
              placeholder="Email"
              className="border rounded-lg px-3 py-2 col-span-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              required
              placeholder="First name"
              className="border rounded-lg px-3 py-2"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <input
              required
              placeholder="Last name"
              className="border rounded-lg px-3 py-2"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            <input
              required
              type="password"
              placeholder="Temporary password (min 8 chars)"
              className="border rounded-lg px-3 py-2 col-span-2"
              value={form.temporaryPassword}
              onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
            />
            <input
              placeholder="Specialization"
              className="border rounded-lg px-3 py-2"
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            />
            <input
              placeholder="License number"
              className="border rounded-lg px-3 py-2"
              value={form.licenseNumber}
              onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving..." : "Save doctor"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Specialization</th>
              <th className="px-4 py-2">License</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td>
              </tr>
            )}
            {practitioners?.length === 0 && !isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={4}>No doctors yet.</td>
              </tr>
            )}
            {practitioners?.map(
              (p: {
                id: string;
                specialization?: string;
                licenseNumber?: string;
                user: { firstName: string; lastName: string; email: string };
              }) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2">
                    {p.user.firstName} {p.user.lastName}
                  </td>
                  <td className="px-4 py-2">{p.user.email}</td>
                  <td className="px-4 py-2">{p.specialization ?? "—"}</td>
                  <td className="px-4 py-2">{p.licenseNumber ?? "—"}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}