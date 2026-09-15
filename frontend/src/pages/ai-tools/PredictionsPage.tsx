import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface BedForecast {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
  occupancyRate: number;
  projectedOccupancyRate: number;
  avgAdmissionsThisWeekday: number;
  riskLevel: "low" | "medium" | "high";
  disclaimer: string;
}

interface ReorderSuggestion {
  itemId: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  urgency: "medium" | "high" | "critical";
  suggestedOrderQty: number;
}

interface RevenueAnalytics {
  dailyTrend: { date: string; amount: number }[];
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  monthGrowthPct: number | null;
  disclaimer: string;
}

interface RevenueAnomaly {
  todayRevenue: number;
  avgDailyRevenue: number;
  isAnomaly: boolean;
  disclaimer: string;
}

interface LabTurnaround {
  currentBacklog: number;
  avgResolvedPerDay: number;
  estimatedDaysToClearBacklog: number | null;
  disclaimer: string;
}

interface InventoryAnomaly {
  itemId: string;
  name: string;
  recentDailyRate: number;
  baselineDailyRate: number;
  spikeRatio: number | null;
}

const riskColor: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

const urgencyColor: Record<string, string> = {
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function PredictionsPage() {
  const { data: bedForecast, isLoading: bedLoading } = useQuery<BedForecast>({
    queryKey: ["bed-occupancy-forecast"],
    queryFn: () => api.get("/ai/predictions/bed-occupancy").then((r) => r.data),
  });

  const { data: reorderData, isLoading: reorderLoading } = useQuery<{ suggestions: ReorderSuggestion[]; disclaimer: string }>({
    queryKey: ["inventory-reorder-suggestions"],
    queryFn: () => api.get("/ai/predictions/inventory-reorder").then((r) => r.data),
  });

  const { data: revenueAnalytics, isLoading: revenueLoading } = useQuery<RevenueAnalytics>({
    queryKey: ["revenue-analytics"],
    queryFn: () => api.get("/ai/predictions/revenue-analytics").then((r) => r.data),
  });

  const { data: revenueAnomaly } = useQuery<RevenueAnomaly>({
    queryKey: ["revenue-anomaly"],
    queryFn: () => api.get("/ai/predictions/revenue-anomaly").then((r) => r.data),
  });

  const { data: labTurnaround, isLoading: labLoading } = useQuery<LabTurnaround>({
    queryKey: ["lab-turnaround"],
    queryFn: () => api.get("/ai/predictions/lab-turnaround").then((r) => r.data),
  });

  const { data: inventoryAnomalyData, isLoading: invAnomalyLoading } = useQuery<{ anomalies: InventoryAnomaly[]; disclaimer: string }>({
    queryKey: ["inventory-anomalies"],
    queryFn: () => api.get("/ai/predictions/inventory-anomalies").then((r) => r.data),
  });

  const maxTrend = Math.max(1, ...(revenueAnalytics?.dailyTrend.map((d) => d.amount) ?? [1]));

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Predictions</h1>
      <p className="text-slate-500 text-sm mb-6">Rule-based forecasts (v1) — planning aids, not guarantees.</p>

      {/* Bed occupancy forecast */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Bed Occupancy Forecast</h2>
        {bedLoading && <p className="text-sm text-slate-400">Loading...</p>}
        {bedForecast && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div><div className="text-xs text-slate-500">Available</div><div className="text-xl font-semibold">{bedForecast.available}</div></div>
              <div><div className="text-xs text-slate-500">Occupied</div><div className="text-xl font-semibold">{bedForecast.occupied}</div></div>
              <div><div className="text-xs text-slate-500">Current rate</div><div className="text-xl font-semibold">{Math.round(bedForecast.occupancyRate * 100)}%</div></div>
              <div>
                <div className="text-xs text-slate-500">Projected rate</div>
                <div className="text-xl font-semibold flex items-center gap-2">
                  {Math.round(bedForecast.projectedOccupancyRate * 100)}%
                  <span className={`text-xs rounded-full px-2 py-0.5 ${riskColor[bedForecast.riskLevel]}`}>{bedForecast.riskLevel}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-amber-700">{bedForecast.disclaimer}</p>
          </>
        )}
      </div>

      {/* Inventory reorder suggestions */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Inventory Reorder Suggestions</h2>
        {reorderLoading && <p className="text-sm text-slate-400">Loading...</p>}
        {reorderData?.suggestions.length === 0 && <p className="text-sm text-slate-400">No items currently need reordering.</p>}
        {reorderData && reorderData.suggestions.length > 0 && (
          <>
            <table className="w-full text-sm mb-3">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1">Item</th><th className="py-1">Stock</th><th className="py-1">Urgency</th><th className="py-1">Suggested qty</th></tr>
              </thead>
              <tbody>
                {reorderData.suggestions.map((s) => (
                  <tr key={s.itemId} className="border-t">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2">{s.currentStock} / {s.reorderLevel}</td>
                    <td className="py-2"><span className={`text-xs rounded-full px-2 py-0.5 ${urgencyColor[s.urgency]}`}>{s.urgency}</span></td>
                    <td className="py-2">{s.suggestedOrderQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-amber-700">{reorderData.disclaimer}</p>
          </>
        )}
      </div>

      {/* Revenue analytics */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Revenue Analytics</h2>
        {revenueLoading && <p className="text-sm text-slate-400">Loading...</p>}
        {revenueAnalytics && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div><div className="text-xs text-slate-500">This month</div><div className="text-xl font-semibold">₹{revenueAnalytics.thisMonthRevenue.toFixed(0)}</div></div>
              <div><div className="text-xs text-slate-500">Last month</div><div className="text-xl font-semibold">₹{revenueAnalytics.lastMonthRevenue.toFixed(0)}</div></div>
              <div>
                <div className="text-xs text-slate-500">Growth</div>
                <div className={`text-xl font-semibold ${revenueAnalytics.monthGrowthPct != null && revenueAnalytics.monthGrowthPct < 0 ? "text-red-600" : "text-green-700"}`}>
                  {revenueAnalytics.monthGrowthPct != null ? `${revenueAnalytics.monthGrowthPct > 0 ? "+" : ""}${revenueAnalytics.monthGrowthPct}%` : "—"}
                </div>
              </div>
            </div>
            <div className="flex items-end gap-1 h-16 mb-2">
              {revenueAnalytics.dailyTrend.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ₹${d.amount.toFixed(0)}`}>
                  <div className="w-full bg-slate-800 rounded-t" style={{ height: `${Math.max(4, (d.amount / maxTrend) * 100)}%` }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mb-2">Last 7 days revenue trend</p>
            {revenueAnomaly?.isAnomaly && (
              <p className="text-xs bg-amber-50 text-amber-800 rounded p-2 mb-2">
                ⚠ Today's revenue (₹{revenueAnomaly.todayRevenue.toFixed(0)}) is unusually high vs. the 14-day average (₹{revenueAnomaly.avgDailyRevenue.toFixed(0)}).
              </p>
            )}
            <p className="text-xs text-amber-700">{revenueAnalytics.disclaimer}</p>
          </>
        )}
      </div>

      {/* Lab turnaround */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Lab Turnaround</h2>
        {labLoading && <p className="text-sm text-slate-400">Loading...</p>}
        {labTurnaround && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div><div className="text-xs text-slate-500">Current backlog</div><div className="text-xl font-semibold">{labTurnaround.currentBacklog}</div></div>
              <div><div className="text-xs text-slate-500">Resolved/day (avg)</div><div className="text-xl font-semibold">{labTurnaround.avgResolvedPerDay}</div></div>
              <div>
                <div className="text-xs text-slate-500">Est. days to clear</div>
                <div className="text-xl font-semibold">{labTurnaround.estimatedDaysToClearBacklog ?? "—"}</div>
              </div>
            </div>
            <p className="text-xs text-amber-700">{labTurnaround.disclaimer}</p>
          </>
        )}
      </div>

      {/* Inventory anomalies */}
      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-3">Inventory Anomalies</h2>
        {invAnomalyLoading && <p className="text-sm text-slate-400">Loading...</p>}
        {inventoryAnomalyData?.anomalies.length === 0 && <p className="text-sm text-slate-400">No unusual dispensing patterns detected.</p>}
        {inventoryAnomalyData && inventoryAnomalyData.anomalies.length > 0 && (
          <>
            <table className="w-full text-sm mb-3">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1">Item</th><th className="py-1">Recent/day</th><th className="py-1">Baseline/day</th><th className="py-1">Spike</th></tr>
              </thead>
              <tbody>
                {inventoryAnomalyData.anomalies.map((a) => (
                  <tr key={a.itemId} className="border-t">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2">{a.recentDailyRate}</td>
                    <td className="py-2">{a.baselineDailyRate}</td>
                    <td className="py-2">
                      <span className="text-xs bg-red-100 text-red-800 rounded-full px-2 py-0.5">
                        {a.spikeRatio ? `${a.spikeRatio}x` : "new"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-amber-700">{inventoryAnomalyData.disclaimer}</p>
          </>
        )}
      </div>
    </div>
  );
}