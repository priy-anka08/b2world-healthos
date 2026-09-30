import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Practitioner {
  id: string;
  user: { firstName: string; lastName: string };
}

interface LabResult { parameter: string; value: string; unit?: string; referenceRange?: string; flag?: string }
interface LabOrder { id: string; createdAt: string; labTest: { name: string }; results: LabResult[] }

interface PortalData {
  firstName: string;
  lastName: string;
  patientCode: string;
  appointments: { id: string; scheduledAt: string; status: string; practitioner: { user: { firstName: string; lastName: string } } }[];
  encounters: { id: string; startedAt: string; medicationRequests: { dosage: string; frequency: string; durationDays?: number }[] }[];
  invoices: { id: string; totalAmount: string; status: string; createdAt: string }[];
  labOrders: LabOrder[];
}

function downloadReport(order: LabOrder, patientName: string) {
  const lines = [
    `Lab Report — ${order.labTest.name}`,
    `Patient: ${patientName}`,
    `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
    "",
    ...order.results.map((r) => `${r.parameter}: ${r.value} ${r.unit ?? ""} (ref: ${r.referenceRange ?? "—"}) ${r.flag && r.flag !== "normal" ? `[${r.flag.toUpperCase()}]` : ""}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${order.labTest.name.replace(/\s+/g, "_")}_report.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PatientPortalPage() {
  const queryClient = useQueryClient();
  const [practitionerId, setPractitionerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookError, setBookError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PortalData>({
    queryKey: ["portal-me"],
    queryFn: () => api.get("/portal/me").then((r) => r.data),
    retry: false,
  });

  const { data: practitioners } = useQuery<Practitioner[]>({
    queryKey: ["portal-practitioners"],
    queryFn: () => api.get("/portal/practitioners").then((r) => r.data),
    enabled: !isError,
  });

  const bookMutation = useMutation({
    mutationFn: () => api.post("/portal/book-appointment", { practitionerId, scheduledAt: new Date(scheduledAt).toISOString() }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      setPractitionerId("");
      setScheduledAt("");
      setBookError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setBookError(axiosErr.response?.data?.error ?? "Failed to book appointment");
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-slate-400">Loading...</div>;

  if (isError) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold mb-2">My Portal</h1>
        <p className="text-sm text-slate-500">This account isn't linked to a patient record. If you're a patient, ask hospital staff to set up portal access for you.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Welcome, {data?.firstName} {data?.lastName}</h1>
      <p className="text-slate-500 text-sm mb-6">Patient code: {data?.patientCode}</p>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Book an appointment</h2>
        {bookError && <p className="text-sm text-red-600 mb-2">{bookError}</p>}
        <div className="flex gap-2 flex-wrap">
          <select className="border rounded-lg px-3 py-2 text-sm flex-1" value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)}>
            <option value="">Select doctor…</option>
            {practitioners?.map((p) => (
              <option key={p.id} value={p.id}>Dr. {p.user.firstName} {p.user.lastName}</option>
            ))}
          </select>
          <input type="datetime-local" className="border rounded-lg px-3 py-2 text-sm" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          <button
            onClick={() => bookMutation.mutate()}
            disabled={bookMutation.isPending || !practitionerId || !scheduledAt}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {bookMutation.isPending ? "Booking..." : "Request appointment"}
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Appointments</h2>
        {data?.appointments.length === 0 && <p className="text-sm text-slate-400">No appointments on record.</p>}
        <div className="space-y-2">
          {data?.appointments.map((a) => (
            <div key={a.id} className="text-sm flex justify-between border-t pt-2 first:border-t-0 first:pt-0">
              <span>Dr. {a.practitioner.user.firstName} {a.practitioner.user.lastName} — {new Date(a.scheduledAt).toLocaleString()}</span>
              <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 self-start">{a.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Prescriptions</h2>
        {data?.encounters.every((e) => e.medicationRequests.length === 0) && <p className="text-sm text-slate-400">No prescriptions on record.</p>}
        <div className="space-y-2">
          {data?.encounters.flatMap((e) =>
            e.medicationRequests.map((rx, i) => (
              <div key={`${e.id}-${i}`} className="text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <b>{rx.dosage}</b> — {rx.frequency}{rx.durationDays && ` · ${rx.durationDays} days`}
                <span className="text-xs text-slate-400 ml-2">{new Date(e.startedAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Lab Reports</h2>
        {data?.labOrders.length === 0 && <p className="text-sm text-slate-400">No verified lab reports yet.</p>}
        <div className="space-y-2">
          {data?.labOrders.map((o) => (
            <div key={o.id} className="text-sm flex justify-between items-center border-t pt-2 first:border-t-0 first:pt-0">
              <span>{o.labTest.name} — {new Date(o.createdAt).toLocaleDateString()}</span>
              <button onClick={() => downloadReport(o, `${data.firstName} ${data.lastName}`)} className="text-xs text-blue-600 underline">Download</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-3">Invoices</h2>
        {data?.invoices.length === 0 && <p className="text-sm text-slate-400">No invoices on record.</p>}
        <div className="space-y-2">
          {data?.invoices.map((inv) => (
            <div key={inv.id} className="text-sm flex justify-between border-t pt-2 first:border-t-0 first:pt-0">
              <span>₹{Number(inv.totalAmount).toFixed(2)} — {new Date(inv.createdAt).toLocaleDateString()}</span>
              <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5">{inv.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}