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
          icon="💳"
          label="Pending payments"
          value={pendingPayments !== undefined ? `₹${pendingPayments.toLocaleString("en-IN")}` : "—"}
          tone={pendingPayments && pendingPayments > 0 ? "amber" : "green"}
        />
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