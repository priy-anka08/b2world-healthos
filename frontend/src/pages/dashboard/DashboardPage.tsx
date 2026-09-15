import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

// Spec section 4 — Hospital Dashboard. Wired to real endpoints where they
// exist (patients, appointments); the rest (beds, revenue, lab turnaround)
// are placeholders that light up once the corresponding Phase 3 module is
// implemented — see backend/src/modules/*/README.md.
export default function DashboardPage() {
  const { user } = useAuth();

  const { data: patients } = useQuery({
    queryKey: ["patients-today"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments-today"],
    queryFn: () => api.get("/appointments", { params: { date: new Date().toISOString() } }).then((r) => r.data),
  });

  const cards = [
    { label: "Patients (recent)", value: patients?.length ?? "—" },
    { label: "Appointments today", value: appointments?.length ?? "—" },
    { label: "Available beds", value: "—", note: "Phase 3" },
    { label: "Pending lab reports", value: "—", note: "Phase 3" },
    { label: "Low stock items", value: "—", note: "Phase 3" },
    { label: "Today's revenue", value: "—", note: "Phase 3" },
  ];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-1">Welcome, {user?.firstName}</h1>
      <p className="text-slate-500 mb-6">Hospital operations overview</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-5">
            <div className="text-sm text-slate-500">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">{c.value}</div>
            {c.note && <div className="text-xs text-amber-600 mt-1">{c.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
