import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import ConsultationPanel from "./ConsultationPanel";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
}

interface Practitioner {
  id: string;
  specialization?: string;
  user: { firstName: string; lastName: string };
}

interface Appointment {
  id: string;
  scheduledAt: string;
  durationMins: number;
  status: string;
  patient: { firstName: string; lastName: string; patientCode: string };
  practitioner: { user: { firstName: string; lastName: string } };
}

const emptyForm = {
  patientId: "",
  practitionerId: "",
  scheduledAt: "",
  durationMins: 20,
};

const riskColor: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [estimateFor, setEstimateFor] = useState<string | null>(null);
  const [riskFor, setRiskFor] = useState<string | null>(null);
  const [consultingAppointmentId, setConsultingAppointmentId] = useState<string | null>(null);

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const { data: practitioners } = useQuery<Practitioner[]>({
    queryKey: ["practitioners"],
    queryFn: () => api.get("/practitioners").then((r) => r.data),
  });

  const today = new Date().toISOString();
  const { data: appointments, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments-list", today.slice(0, 10)],
    queryFn: () => api.get("/appointments", { params: { date: today } }).then((r) => r.data),
  });

  const { data: estimate } = useQuery({
    queryKey: ["queue-estimate", estimateFor],
    queryFn: () => api.get(`/appointments/${estimateFor}/queue-estimate`).then((r) => r.data),
    enabled: !!estimateFor,
  });

  const { data: risk } = useQuery({
    queryKey: ["no-show-risk", riskFor],
    queryFn: () => api.get(`/appointments/${riskFor}/no-show-risk`).then((r) => r.data),
    enabled: !!riskFor,
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      api.post("/appointments", { ...payload, scheduledAt: new Date(payload.scheduledAt).toISOString() }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-list"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-today"] });
      setForm(emptyForm);
      setShowForm(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Failed to book appointment");
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
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-slate-500 text-sm">{appointments?.length ?? 0} today</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ Book appointment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          {error && <div className="text-sm text-red-600">{error}</div>}

          <select
            required
            className="w-full border rounded-lg px-3 py-2"
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
          >
            <option value="">Select patient…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.patientCode})
              </option>
            ))}
          </select>

          <select
            required
            className="w-full border rounded-lg px-3 py-2"
            value={form.practitionerId}
            onChange={(e) => setForm({ ...form, practitionerId: e.target.value })}
          >
            <option value="">Select doctor…</option>
            {practitioners?.map((p) => (
              <option key={p.id} value={p.id}>
                Dr. {p.user.firstName} {p.user.lastName} {p.specialization ? `— ${p.specialization}` : ""}
              </option>
            ))}
          </select>

          <input
            required
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2"
            value={form.scheduledAt}
            onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
          />

          <input
            type="number"
            min={5}
            step={5}
            placeholder="Duration (mins)"
            className="w-full border rounded-lg px-3 py-2"
            value={form.durationMins}
            onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })}
          />

          {(!patients?.length || !practitioners?.length) && (
            <p className="text-xs text-amber-600">
              {!patients?.length && "Add a patient first. "}
              {!practitioners?.length && "Add a doctor first."}
            </p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Booking..." : "Book appointment"}
          </button>
        </form>
      )}

      {estimateFor && estimate && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 mb-6 max-w-lg text-sm">
          <p className="font-medium text-blue-900">
            ~{estimate.estimatedWaitMinutes} min estimated wait — {estimate.patientsAhead} patient(s) ahead
          </p>
          <p className="text-blue-700 text-xs mt-1">{estimate.disclaimer}</p>
          <button onClick={() => setEstimateFor(null)} className="text-xs text-blue-600 underline mt-2">
            Close
          </button>
        </div>
      )}

      {riskFor && risk && (
        <div className="border border-slate-200 bg-slate-50 rounded-lg p-4 mb-6 max-w-lg text-sm">
          <p className="font-medium">
            No-show risk: <span className={`rounded-full px-2 py-0.5 text-xs ${riskColor[risk.level]}`}>{risk.level}</span>
            {" "}({Math.round(risk.riskScore * 100)}%, based on {risk.basedOnAppointments} past appointment(s))
          </p>
          <p className="text-slate-500 text-xs mt-1">{risk.disclaimer}</p>
          <button onClick={() => setRiskFor(null)} className="text-xs text-blue-600 underline mt-2">
            Close
          </button>
        </div>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Doctor</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>Loading...</td>
              </tr>
            )}
            {appointments?.length === 0 && !isLoading && (
              <tr>
                <td className="px-4 py-4 text-slate-400" colSpan={5}>No appointments today.</td>
              </tr>
            )}
            {appointments?.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-4 py-2">
                  {new Date(a.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  {a.patient.firstName} {a.patient.lastName}
                </td>
                <td className="px-4 py-2">
                  Dr. {a.practitioner.user.firstName} {a.practitioner.user.lastName}
                </td>
                <td className="px-4 py-2">
                  <span className="text-xs bg-slate-100 rounded-full px-2 py-1">{a.status}</span>
                </td>
                <td className="px-4 py-2 space-x-3">
                  <button onClick={() => setEstimateFor(a.id)} className="text-xs text-blue-600 underline">
                    Queue estimate
                  </button>
                  <button onClick={() => setRiskFor(a.id)} className="text-xs text-blue-600 underline">
                    No-show risk
                  </button>
                  {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                    <button
                      onClick={() => setConsultingAppointmentId(a.id)}
                      className="text-xs text-green-700 underline font-medium"
                    >
                      Start consultation
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {consultingAppointmentId && (
        <ConsultationPanel
          appointmentId={consultingAppointmentId}
          onClose={() => setConsultingAppointmentId(null)}
        />
      )}
    </div>
  );
}