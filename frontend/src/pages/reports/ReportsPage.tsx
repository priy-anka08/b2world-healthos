import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Summary {
  patients: { total: number; newThisMonth: number };
  appointments: { thisMonth: number; completed: number; noShows: number; noShowRate: number };
  finance: { revenueThisMonth: number; unpaidInvoiceCount: number };
  staff: { activeCount: number };
  beds: { total: number; occupied: number; occupancyRate: number };
  pharmacy: { lowStockItemCount: number };
  laboratory: { pendingOrders: number };
}

export default function ReportsPage() {
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["reports-summary"],
    queryFn: () => api.get("/reports/summary").then((r) => r.data),
  });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Reports</h1>
      <p className="text-slate-500 text-sm mb-6">Operational summary for the current month.</p>

      {isLoading && <p className="text-sm text-slate-400">Loading...</p>}

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Total patients</div>
            <div className="text-2xl font-semibold">{data.patients.total}</div>
            <div className="text-xs text-slate-400 mt-1">+{data.patients.newThisMonth} this month</div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Appointments this month</div>
            <div className="text-2xl font-semibold">{data.appointments.thisMonth}</div>
            <div className="text-xs text-slate-400 mt-1">
              {data.appointments.completed} completed · {data.appointments.noShows} no-shows (
              {Math.round(data.appointments.noShowRate * 100)}%)
            </div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Revenue this month</div>
            <div className="text-2xl font-semibold">₹{data.finance.revenueThisMonth.toFixed(2)}</div>
            <div className="text-xs text-slate-400 mt-1">{data.finance.unpaidInvoiceCount} unpaid invoice(s)</div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Active staff</div>
            <div className="text-2xl font-semibold">{data.staff.activeCount}</div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Bed occupancy</div>
            <div className="text-2xl font-semibold">{Math.round(data.beds.occupancyRate * 100)}%</div>
            <div className="text-xs text-slate-400 mt-1">{data.beds.occupied} / {data.beds.total} beds</div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Low stock items</div>
            <div className="text-2xl font-semibold">{data.pharmacy.lowStockItemCount}</div>
          </div>
          <div className="bg-white border rounded-xl p-5">
            <div className="text-xs text-slate-500">Pending lab orders</div>
            <div className="text-2xl font-semibold">{data.laboratory.pendingOrders}</div>
          </div>
        </div>
      )}
    </div>
  );
}