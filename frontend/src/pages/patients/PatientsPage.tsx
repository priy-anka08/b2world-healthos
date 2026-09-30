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

const emptyForm = { patientCode: "", firstName: "", lastName: "", contactPhone: "", gender: "" };
const emptyEditForm = { firstName: "", lastName: "", contactPhone: "", contactEmail: "", address: "", emergencyContact: "", bloodGroup: "" };

export default function PatientsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitingPatientId, setInvitingPatientId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [docPatientId, setDocPatientId] = useState<string | null>(null);
  const [docType, setDocType] = useState("id_proof");
  const [docRef, setDocRef] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form & { acknowledgedDuplicates?: boolean }) => api.post("/patients", payload).then((r) => r.data),
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

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof editForm }) => api.patch(`/patients/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setEditingPatientId(null);
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: ({ id, type, fileUrl }: { id: string; type: string; fileUrl: string }) =>
      api.post(`/patients/${id}/documents`, { type, fileUrl }).then((r) => r.data),
    onSuccess: () => {
      setDocPatientId(null);
      setDocRef("");
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

  function startEdit(p: { id: string; firstName: string; lastName: string; contactPhone?: string; contactEmail?: string; address?: string; emergencyContact?: string; bloodGroup?: string }) {
    setEditingPatientId(p.id);
    setEditForm({
      firstName: p.firstName,
      lastName: p.lastName,
      contactPhone: p.contactPhone ?? "",
      contactEmail: p.contactEmail ?? "",
      address: p.address ?? "",
      emergencyContact: p.emergencyContact ?? "",
      bloodGroup: p.bloodGroup ?? "",
    });
  }

  async function openReceipt(id: string) {
    const { data } = await api.get(`/patients/${id}/receipt`);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>${data.receiptNumber}</title></head>
      <body style="font-family:sans-serif;padding:32px;max-width:500px;margin:0 auto;">
        <h2>${data.hospital.name}</h2>
        <p>${data.hospital.address ?? ""} ${data.hospital.phone ?? ""}</p>
        <hr/>
        <h3>Patient Registration Receipt</h3>
        <p><b>Receipt #:</b> ${data.receiptNumber}</p>
        <p><b>Issued:</b> ${new Date(data.issuedAt).toLocaleString()}</p>
        <hr/>
        <p><b>Patient ID:</b> ${data.patient.patientCode}</p>
        <p><b>Name:</b> ${data.patient.name}</p>
        <p><b>Gender:</b> ${data.patient.gender ?? "—"}</p>
        <p><b>Phone:</b> ${data.patient.contactPhone ?? "—"}</p>
        <p><b>Emergency contact:</b> ${data.patient.emergencyContact ?? "—"}</p>
        <p><b>Blood group:</b> ${data.patient.bloodGroup ?? "—"}</p>
        <p><b>Registered on:</b> ${new Date(data.patient.registeredOn).toLocaleDateString()}</p>
        <script>window.print();</script>
      </body></html>
    `);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          <p className="text-slate-500 text-sm">{patients?.length ?? 0} patients</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add patient"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Patient code (e.g. P-0001)" className="border rounded-lg px-3 py-2 col-span-2" value={form.patientCode} onChange={(e) => setForm({ ...form, patientCode: e.target.value })} />
            <input required placeholder="First name" className="border rounded-lg px-3 py-2" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input required placeholder="Last name" className="border rounded-lg px-3 py-2" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <input placeholder="Phone" className="border rounded-lg px-3 py-2" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            <input placeholder="Gender" className="border rounded-lg px-3 py-2" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Saving..." : "Save patient"}
          </button>
          {duplicates && duplicates.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 mt-3">
              <p className="text-sm font-medium text-amber-800 mb-2">Possible duplicate patient record — review before continuing:</p>
              <ul className="text-sm text-amber-900 space-y-1 mb-3">
                {duplicates.map((d) => (
                  <li key={d.id}>{d.firstName} {d.lastName} ({d.patientCode}) — matched on {d.matchReason.join(", ")}</li>
                ))}
              </ul>
              <button type="button" onClick={handleConfirmAnyway} className="text-sm bg-amber-700 text-white rounded-lg px-3 py-1.5">
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
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>Loading...</td></tr>}
            {patients?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={6}>No patients yet.</td></tr>}
            {patients?.map((p: { id: string; patientCode: string; firstName: string; lastName: string; contactPhone?: string; contactEmail?: string; address?: string; emergencyContact?: string; bloodGroup?: string; gender?: string; userId?: string | null }) => (
              <>
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
                        <input type="email" placeholder="Email" className="border rounded px-2 py-1 text-xs w-40" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                        <input type="password" placeholder="Temp password" className="border rounded px-2 py-1 text-xs w-40" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />
                        <button onClick={() => inviteMutation.mutate({ patientId: p.id, email: inviteEmail, temporaryPassword: invitePassword })} disabled={inviteMutation.isPending || !inviteEmail || invitePassword.length < 8} className="text-xs bg-slate-900 text-white rounded px-2 py-1 self-start disabled:opacity-50">
                          Send invite
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setInvitingPatientId(p.id)} className="text-xs text-blue-600 underline">Invite portal access</button>
                    )}
                  </td>
                  <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="text-xs text-blue-600 underline">Edit</button>
                    <button onClick={() => openReceipt(p.id)} className="text-xs text-blue-600 underline">Receipt</button>
                    <button onClick={() => setDocPatientId(docPatientId === p.id ? null : p.id)} className="text-xs text-blue-600 underline">Upload doc</button>
                  </td>
                </tr>
                {editingPatientId === p.id && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="First name" className="border rounded px-2 py-1 text-sm" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                        <input placeholder="Last name" className="border rounded px-2 py-1 text-sm" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                        <input placeholder="Phone" className="border rounded px-2 py-1 text-sm" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} />
                        <input placeholder="Email" className="border rounded px-2 py-1 text-sm" value={editForm.contactEmail} onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })} />
                        <input placeholder="Address" className="border rounded px-2 py-1 text-sm" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                        <input placeholder="Emergency contact" className="border rounded px-2 py-1 text-sm" value={editForm.emergencyContact} onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })} />
                        <input placeholder="Blood group" className="border rounded px-2 py-1 text-sm" value={editForm.bloodGroup} onChange={(e) => setEditForm({ ...editForm, bloodGroup: e.target.value })} />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button onClick={() => updateMutation.mutate({ id: p.id, payload: editForm })} disabled={updateMutation.isPending} className="text-xs bg-slate-900 text-white rounded px-3 py-1.5">
                          {updateMutation.isPending ? "Saving..." : "Save changes"}
                        </button>
                        <button onClick={() => setEditingPatientId(null)} className="text-xs text-slate-500 underline">Cancel</button>
                      </div>
                    </td>
                  </tr>
                )}
                {docPatientId === p.id && (
                  <tr className="border-t bg-slate-50">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="flex gap-2 items-center flex-wrap">
                        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="border rounded px-2 py-1 text-xs">
                          <option value="id_proof">ID proof</option>
                          <option value="prescription">Prescription</option>
                          <option value="lab_report">Lab report</option>
                          <option value="discharge_summary">Discharge summary</option>
                          <option value="referral">Referral</option>
                          <option value="other">Other</option>
                        </select>
                        <input placeholder="Document reference / link / filename" className="border rounded px-2 py-1 text-xs flex-1" value={docRef} onChange={(e) => setDocRef(e.target.value)} />
                        <button
                          onClick={() => uploadDocMutation.mutate({ id: p.id, type: docType, fileUrl: docRef })}
                          disabled={!docRef || uploadDocMutation.isPending}
                          className="text-xs bg-slate-900 text-white rounded px-3 py-1.5 disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">MVP note: no file storage backend yet — this records a reference/filename, not the file bytes.</p>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
          <MergePanel patients={patients ?? []} />
    </div>
  );
}

function MergePanel({ patients }: { patients: { id: string; firstName: string; lastName: string; patientCode: string }[] }) {
  const queryClient = useQueryClient();
  const [keepId, setKeepId] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mergeMutation = useMutation({
    mutationFn: () => api.post(`/patients/${keepId}/merge`, { duplicateId: mergeId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setKeepId(""); setMergeId(""); setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Merge failed");
    },
  });

  return (
    <div className="bg-white border rounded-xl p-6 mt-6">
      <h2 className="font-semibold mb-1">Merge duplicate records</h2>
      <p className="text-xs text-slate-500 mb-3">A human must confirm every merge — this never happens automatically (spec §5).</p>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2 flex-wrap items-center">
        <select value={keepId} onChange={(e) => setKeepId(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Keep this record…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientCode})</option>)}
        </select>
        <span className="text-sm text-slate-400">merge into it →</span>
        <select value={mergeId} onChange={(e) => setMergeId(e.target.value)} className="border rounded px-2 py-1 text-sm">
          <option value="">Duplicate record to merge…</option>
          {patients.filter((p) => p.id !== keepId).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientCode})</option>)}
        </select>
        <button
          onClick={() => mergeMutation.mutate()}
          disabled={!keepId || !mergeId || mergeMutation.isPending}
          className="bg-slate-900 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {mergeMutation.isPending ? "Merging..." : "Merge"}
        </button>
      </div>
    </div>
  );
}