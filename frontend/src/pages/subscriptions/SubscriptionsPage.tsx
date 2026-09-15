import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Subscription {
  id: string;
  planName: string;
  status: string;
  seatLimit?: number;
  organization: { name: string; slug: string };
}

const emptyForm = { organizationId: "", planName: "starter", seatLimit: 10 };

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-blue-100 text-blue-800",
  past_due: "bg-amber-100 text-amber-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: () => api.get("/organizations").then((r) => r.data),
  });

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ["subscriptions"],
    queryFn: () => api.get("/subscriptions").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/subscriptions", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/subscriptions/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Subscriptions</h1>
          <p className="text-slate-500 text-sm">Platform-level billing (super admin only)</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ New subscription"}
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
          <select required className="w-full border rounded-lg px-3 py-2 text-sm" value={form.organizationId}
            onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">Select organization…</option>
            {organizations?.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.planName}
            onChange={(e) => setForm({ ...form, planName: e.target.value })}>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input type="number" min={1} placeholder="Seat limit" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.seatLimit} onChange={(e) => setForm({ ...form, seatLimit: Number(e.target.value) })} />
          <button type="submit" disabled={createMutation.isPending} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Creating..." : "Create subscription"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Organization</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Seats</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>Loading...</td></tr>}
            {subscriptions?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>No subscriptions yet.</td></tr>}
            {subscriptions?.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.organization.name}</td>
                <td className="px-4 py-2 capitalize">{s.planName}</td>
                <td className="px-4 py-2">{s.seatLimit ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs rounded-full px-2 py-1 ${statusColor[s.status]}`}>{s.status}</span>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={s.status}
                    onChange={(e) => statusMutation.mutate({ id: s.id, status: e.target.value })}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past due</option>
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