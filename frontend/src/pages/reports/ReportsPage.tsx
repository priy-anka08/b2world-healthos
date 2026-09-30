import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Summary {
  patients: { total: number; newThisMonth: number };
  appointments: { thisMonth: number; completed: number; noShows: number; noShowRate: number };
  finance: { revenueThisMonth: number; unpaidInvoiceCount: number };
  staff: { activeCount: number };
  beds: { total: number; occupied: number; occupancyRate: number };
  pharmacy: { lowStockItemCount: number; consumptionThisMonth: number };
  laboratory: { pendingOrders: number; avgTurnaroundDaysToClearBacklog: number | null };
  emergency: { casesToday: number; hasDedicatedDepartment: boolean };
  departmentPerformance: { name: string; appointmentsThisMonth: number }[];
  avgWaitingTimeMinutesToday: number | null;
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
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs text-slate-500">Total patients</div>
              <div className="text-2xl font-semibold">{data.patients.total}</div>
              <div className="text-xs text-slate-400 mt-1">+{data.patients.newThisMonth} this month</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs text-slate-500">Appointments this month</div>
              <div className="text-2xl font-semibold">{data.appointments.thisMonth}</div>
              <div className="text-xs text-slate-400 mt-1">
                {data.appointments.completed} completed · {data.appointments.noShows} no-shows ({Math.round(data.appointments.noShowRate * 100)}%)
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
              <div className="text-xs text-slate-400 mt-1">{data.pharmacy.consumptionThisMonth} units dispensed this month</div>
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs text-slate-500">Pending lab orders</div>
              <div className="text-2xl font-semibold">{data.laboratory.pendingOrders}</div>
              {data.laboratory.avgTurnaroundDaysToClearBacklog != null && (
                <div className="text-xs text-slate-400 mt-1">~{data.laboratory.avgTurnaroundDaysToClearBacklog}d to clear backlog</div>
              )}
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs text-slate-500">Emergency cases today</div>
              <div className="text-2xl font-semibold">{data.emergency.casesToday}</div>
              {!data.emergency.hasDedicatedDepartment && <div className="text-xs text-amber-600 mt-1">No 'Emergency' department found</div>}
            </div>
            <div className="bg-white border rounded-xl p-5">
              <div className="text-xs text-slate-500">Avg waiting time today</div>
              <div className="text-2xl font-semibold">{data.avgWaitingTimeMinutesToday != null ? `${data.avgWaitingTimeMinutesToday} min` : "—"}</div>
            </div>
          </div>

          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-3">Department performance (this month)</h2>
            {data.departmentPerformance.length === 0 && <p className="text-sm text-slate-400">No department data yet.</p>}
            <div className="space-y-2">
              {data.departmentPerformance.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="text-sm w-32 truncate">{d.name}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-slate-700 h-2 rounded-full"
                      style={{ width: `${Math.min(100, (d.appointmentsThisMonth / Math.max(...data.departmentPerformance.map((x) => x.appointmentsThisMonth), 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-10 text-right">{d.appointmentsThisMonth}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}