import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Duplicate {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  matchReason: string[];
}

const emptyForm = {
  patientCode: "",
  firstName: "",
  lastName: "",
  contactPhone: "",
  gender: "",
};

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitingPatientId, setInvitingPatientId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form & { acknowledgedDuplicates?: boolean }) =>
      api.post("/patients", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients-today"] });
      setForm(emptyForm);
      setDuplicates(null);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { status: number; data: { duplicates?: Duplicate[]; error?: string } } };
      if (axiosErr.response?.status === 409 && axiosErr.response.data.duplicates) {
        setDuplicates(axiosErr.response.data.duplicates);
      } else {
        setError(axiosErr.response?.data?.error ?? "Failed to create patient");
      }
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ patientId, email, temporaryPassword }: { patientId: string; email: string; temporaryPassword: string }) =>
      api.post(`/portal/invite/${patientId}`, { email, temporaryPassword }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setInvitingPatientId(null);
      setInviteEmail("");
      setInvitePassword("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate(form);
  }

  function handleConfirmAnyway() {
    createMutation.mutate({ ...form, acknowledgedDuplicates: true });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          <p className="text-slate-500 text-sm">{patients?.length ?? 0} patients</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Add patient"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <input
              required
              placeholder="Patient code (e.g. P-0001)"
              className="border rounded-lg px-3 py-2 col-span-2"
              value={form.patientCode}
              onChange={(e) => setForm({ ...form, patientCode: e.target.value })}
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
              placeholder="Phone"
              className="border rounded-lg px-3 py-2"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
            <input
              placeholder="Gender"
              className="border rounded-lg px-3 py-2"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Saving..." : "Save patient"}
          </button>

          {duplicates && duplicates.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mt-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Possible duplicate patient record — review before continuing:
              </p>
              <ul className="text-sm text-amber-900 space-y-1 mb-3">
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.firstName} {d.lastName} ({d.patientCode}) — matched on {d.matchReason.join(", ")}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleConfirmAnyway}
                className="text-sm bg-amber-700 text-white rounded-lg px-3 py-1.5"
              >
                This is a genuinely new patient — save anyway
              </button>
            </div>
          )}
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Gender</th>
              <th className="px-4 py-2">Portal</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>Loading...</td>
              </tr>
            )}
            {patients?.length === 0 && !isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>No patients yet.</td>
              </tr>
            )}
            {patients?.map((p: { id: string; patientCode: string; firstName: string; lastName: string; contactPhone?: string; gender?: string; userId?: string | null }) => (
              <tr key={p.id} className="border-t align-top">
                <td className="px-4 py-2">{p.patientCode}</td>
                <td className="px-4 py-2">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-2">{p.contactPhone ?? "—"}</td>
                <td className="px-4 py-2">{p.gender ?? "—"}</td>
                <td className="px-4 py-2">
                  {p.userId ? (
                    <span className="text-xs bg-green-100 text-green-800 rounded-full px-2 py-0.5">Active</span>
                  ) : invitingPatientId === p.id ? (
                    <div className="flex flex-col gap-1">
                      <input type="email" placeholder="Email" className="border rounded px-2 py-1 text-xs w-40"
                        value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                      <input type="password" placeholder="Temp password" className="border rounded px-2 py-1 text-xs w-40"
                        value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />
                      <button
                        onClick={() => inviteMutation.mutate({ patientId: p.id, email: inviteEmail, temporaryPassword: invitePassword })}
                        disabled={inviteMutation.isPending || !inviteEmail || invitePassword.length < 8}
                        className="text-xs bg-slate-900 text-white rounded px-2 py-1 self-start disabled:opacity-50"
                      >
                        Send invite
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setInvitingPatientId(p.id)} className="text-xs text-blue-600 underline">
                      Invite portal access
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}