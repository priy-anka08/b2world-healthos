import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, StatCard, Card } from "@/components/ui/Primitives";

interface BedSummary {
  total: number;
  available: number;
  occupied: number;
}
interface LabOrder {
  id: string;
  status: string;
}
interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
}
interface Invoice {
  id: string;
  totalAmount: number;
  status: string;
  payments: { amount: number; createdAt: string }[];
}

function isToday(dateStr: string) {
  return new Date(dateStr).toDateString() === new Date().toDateString();
}

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

  const { data: beds } = useQuery<BedSummary>({
    queryKey: ["beds-summary"],
    queryFn: () => api.get("/beds/summary").then((r) => r.data),
  });

  const { data: labOrders } = useQuery<LabOrder[]>({
    queryKey: ["lab-orders"],
    queryFn: () => api.get("/laboratory/orders").then((r) => r.data),
  });

  const { data: lowStock } = useQuery<InventoryItem[]>({
    queryKey: ["low-stock"],
    queryFn: () => api.get("/inventory/low-stock").then((r) => r.data),
  });

  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ["invoices-dashboard"],
    queryFn: () => api.get("/billing/invoices").then((r) => r.data),
  });

  const { data: summary } = useQuery<{
    emergency: { casesToday: number; hasDedicatedDepartment: boolean };
    departmentPerformance: { name: string; appointmentsThisMonth: number }[];
    avgWaitingTimeMinutesToday: number | null;
    pharmacy: { consumptionThisMonth: number };
    laboratory: { pendingOrders: number; avgTurnaroundDaysToClearBacklog: number | null };
  }>({
    queryKey: ["reports-summary"],
    queryFn: () => api.get("/reports/summary").then((r) => r.data),
  });

  const pendingLabCount = labOrders?.filter((o) => o.status !== "reviewed").length;
  const todaysRevenue = invoices
    ?.flatMap((inv) => inv.payments)
    .filter((p) => isToday(p.createdAt))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingPayments = invoices
    ?.filter((inv) => inv.status !== "paid")
    .reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      return sum + (Number(inv.totalAmount) - paid);
    }, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
            <div className="rounded-2xl bg-teal-gradient p-6 mb-6 text-white shadow-sm">
        <h1 className="text-2xl font-bold">Welcome, {user?.firstName ?? ""} 👋</h1>
        <p className="text-teal-100 text-sm mt-1">Hospital operations overview, live from HealthOS.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🧑‍🤝‍🧑" label="Total patients" value={patients?.length ?? "—"} tone="brand" />
        <StatCard icon="📅" label="Appointments today" value={appointments?.length ?? "—"} tone="accent" />
        <StatCard
          icon="🛏️"
          label="Available beds"
          value={beds ? `${beds.available}/${beds.total}` : "—"}
          hint={beds ? `${beds.occupied} occupied` : undefined}
          tone={beds && beds.available === 0 ? "red" : "green"}
        />
        <StatCard
          icon="🧪"
          label="Pending lab reports"
          value={pendingLabCount ?? "—"}
          tone={pendingLabCount && pendingLabCount > 0 ? "amber" : "green"}
        />
        <StatCard
          icon="📦"
          label="Low stock items"
          value={lowStock?.length ?? "—"}
          hint={lowStock && lowStock.length > 0 ? lowStock.slice(0, 2).map((i) => i.name).join(", ") : undefined}
          tone={lowStock && lowStock.length > 0 ? "amber" : "green"}
        />
        <StatCard
          icon="💰"
          label="Today's revenue"
          value={todaysRevenue !== undefined ? `₹${todaysRevenue.toLocaleString("en-IN")}` : "—"}
          tone="green"
        />
        <StatCard
          label="Pending payments"
          value={pendingPayments !== undefined ? `₹${pendingPayments.toLocaleString("en-IN")}` : "—"}
          tone={pendingPayments && pendingPayments > 0 ? "amber" : "green"}
        />
        <StatCard
          icon="🚨"
          label="Emergency cases today"
          value={summary?.emergency.casesToday ?? "—"}
          hint={summary && !summary.emergency.hasDedicatedDepartment ? "No 'Emergency' dept found" : undefined}
          tone={summary?.emergency.casesToday ? "red" : "green"}
        />
        <StatCard icon="⏱️" label="Avg waiting time" value={summary?.avgWaitingTimeMinutesToday != null ? `${summary.avgWaitingTimeMinutesToday} min` : "—"} tone="brand" />
        <StatCard icon="💊" label="Pharmacy consumption (month)" value={summary?.pharmacy.consumptionThisMonth ?? "—"} tone="brand" />
        <StatCard icon="🧪" label="Lab backlog clear-time" value={summary?.laboratory.avgTurnaroundDaysToClearBacklog != null ? `${summary.laboratory.avgTurnaroundDaysToClearBacklog}d` : "—"} tone={summary?.laboratory.pendingOrders ? "amber" : "green"} />
      </div>

      <div className="card p-6 mb-8">
        <h2 className="font-semibold mb-3">Department performance (this month)</h2>
        {summary?.departmentPerformance.length === 0 && <p className="text-sm text-ink-400">No department data yet.</p>}
        <div className="space-y-2">
          {summary?.departmentPerformance.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="text-sm w-32 truncate">{d.name}</span>
              <div className="flex-1 bg-ink-100 rounded-full h-2">
                <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${Math.min(100, (d.appointmentsThisMonth / Math.max(...summary.departmentPerformance.map((x) => x.appointmentsThisMonth), 1)) * 100)}%` }} />
              </div>
              <span className="text-xs text-ink-400 w-10 text-right">{d.appointmentsThisMonth}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold mb-3">Quick links</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/patients" className="btn-secondary justify-start">🧑‍🤝‍🧑 Patients</Link>
            <Link to="/appointments" className="btn-secondary justify-start">📅 Appointments</Link>
            <Link to="/document-ocr" className="btn-secondary justify-start">🧾 Document OCR</Link>
            <Link to="/ai-tools" className="btn-secondary justify-start">🤖 AI Copilot</Link>
          </div>
        </Card>
        <Card>
          <h2 className="font-semibold mb-3">System status</h2>
          <ul className="text-sm text-ink-600 space-y-1.5">
            <li>Signed in as <span className="font-medium text-ink-900">{user?.email}</span></li>
            <li>Dashboard refreshes automatically as records change.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}