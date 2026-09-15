import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface PortalData {
  firstName: string;
  lastName: string;
  patientCode: string;
  appointments: {
    id: string;
    scheduledAt: string;
    status: string;
    practitioner: { user: { firstName: string; lastName: string } };
  }[];
  encounters: {
    id: string;
    startedAt: string;
    medicationRequests: { dosage: string; frequency: string; durationDays?: number }[];
  }[];
  invoices: { id: string; totalAmount: string; status: string; createdAt: string }[];
}

export default function PatientPortalPage() {
  const { data, isLoading, isError } = useQuery<PortalData>({
    queryKey: ["portal-me"],
    queryFn: () => api.get("/portal/me").then((r) => r.data),
    retry: false,
  });

  if (isLoading) return <div className="p-8 text-sm text-slate-400">Loading...</div>;

  if (isError) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-bold mb-2">My Portal</h1>
        <p className="text-sm text-slate-500">
          This account isn't linked to a patient record. If you're a patient, ask hospital staff to set up portal
          access for you.
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">
        Welcome, {data?.firstName} {data?.lastName}
      </h1>
      <p className="text-slate-500 text-sm mb-6">Patient code: {data?.patientCode}</p>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Appointments</h2>
        {data?.appointments.length === 0 && <p className="text-sm text-slate-400">No appointments on record.</p>}
        <div className="space-y-2">
          {data?.appointments.map((a) => (
            <div key={a.id} className="text-sm flex justify-between border-t pt-2 first:border-t-0 first:pt-0">
              <span>
                Dr. {a.practitioner.user.firstName} {a.practitioner.user.lastName} —{" "}
                {new Date(a.scheduledAt).toLocaleString()}
              </span>
              <span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 self-start">{a.status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Prescriptions</h2>
        {data?.encounters.every((e) => e.medicationRequests.length === 0) && (
          <p className="text-sm text-slate-400">No prescriptions on record.</p>
        )}
        <div className="space-y-2">
          {data?.encounters.flatMap((e) =>
            e.medicationRequests.map((rx, i) => (
              <div key={`${e.id}-${i}`} className="text-sm border-t pt-2 first:border-t-0 first:pt-0">
                <b>{rx.dosage}</b> — {rx.frequency}
                {rx.durationDays && ` · ${rx.durationDays} days`}
                <span className="text-xs text-slate-400 ml-2">{new Date(e.startedAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
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