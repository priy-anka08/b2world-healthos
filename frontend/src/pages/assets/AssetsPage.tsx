import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { PageHeader, Badge } from "@/components/ui/Primitives";

interface MaintenanceRecord {
  id: string;
  type: string;
  notes?: string;
  performedAt: string;
}
interface Asset {
  id: string;
  name: string;
  category: string;
  location?: string;
  status: string;
  maintenanceRecords: MaintenanceRecord[];
}
interface RiskEntry {
  assetId: string;
  maintenanceRiskScore: number;
  riskLevel: "low" | "medium" | "high";
  daysSinceLastService: number | null;
  recentRepairCount: number;
}

const emptyForm = { name: "", category: "Other", location: "" };

const statusColor: Record<string, string> = {
  operational: "bg-success-100 text-success-700",
  maintenance: "bg-warning-100 text-warning-700",
  decommissioned: "bg-ink-200 text-ink-600",
};

const riskTone: Record<string, "green" | "amber" | "red"> = { low: "green", medium: "amber", high: "red" };

export default function AssetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [logNotes, setLogNotes] = useState("");
  const [logType, setLogType] = useState<"scheduled" | "repair" | "inspection">("inspection");

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => api.get("/assets").then((r) => r.data),
  });

  // Fetched on demand — the backend recalculates and writes a fresh score
  // for every asset each time, so it's not something to auto-run on load.
  const { data: risks, refetch: refetchRisks, isFetching: scoring } = useQuery<RiskEntry[]>({
    queryKey: ["assets-maintenance-risk"],
    queryFn: () => api.get("/assets/maintenance-risk").then((r) => r.data),
    enabled: false,
  });
  const riskByAssetId = Object.fromEntries((risks ?? []).map((r) => [r.assetId, r]));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["assets"] });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/assets", payload).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/assets/${id}/status`, { status }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const maintenanceMutation = useMutation({
    mutationFn: ({ id, type, notes }: { id: string; type: string; notes?: string }) =>
      api.post(`/assets/${id}/maintenance`, { type, notes }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setLogFor(null);
      setLogNotes("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Assets"
        description={`${assets?.length ?? 0} pieces of equipment`}
        action={
          <div className="flex gap-2">
            <button onClick={() => refetchRisks()} disabled={scoring} className="btn-secondary">
              {scoring ? "Scoring..." : "Score maintenance risk"}
            </button>
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
              {showForm ? "Cancel" : "+ Add asset"}
            </button>
          </div>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 mb-6 space-y-3 max-w-lg">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Asset name (e.g. Ventilator #3)" className="input col-span-2"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="CT">CT Scanner</option>
              <option value="MRI">MRI</option>
              <option value="X-Ray">X-Ray</option>
              <option value="Ultrasound">Ultrasound</option>
              <option value="Ventilator">Ventilator</option>
              <option value="Monitor">Monitor</option>
              <option value="Other">Other</option>
            </select>
            <input placeholder="Location" className="input"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? "Saving..." : "Save asset"}
          </button>
        </form>
      )}

      {isLoading && <p className="text-ink-400 text-sm">Loading...</p>}
      {assets?.length === 0 && !isLoading && <p className="text-ink-400 text-sm">No assets yet — add one above.</p>}

      <div className="space-y-3">
        {assets?.map((asset) => {
          const risk = riskByAssetId[asset.id];
          return (
            <div key={asset.id} className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-medium">{asset.name}</div>
                  <div className="text-xs text-ink-500">{asset.category} {asset.location && `· ${asset.location}`}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {risk && (
                    <Badge tone={riskTone[risk.riskLevel]}>
                      {risk.riskLevel} risk ({Math.round(risk.maintenanceRiskScore * 100)}%)
                    </Badge>
                  )}
                  <span className={`text-xs rounded-full px-2 py-1 capitalize ${statusColor[asset.status] ?? "bg-ink-100"}`}>
                    {asset.status}
                  </span>
                  <select
                    value={asset.status}
                    onChange={(e) => statusMutation.mutate({ id: asset.id, status: e.target.value })}
                    className="text-xs border border-ink-200 rounded px-2 py-1"
                  >
                    <option value="operational">Operational</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                  <button onClick={() => setLogFor(logFor === asset.id ? null : asset.id)} className="text-xs text-teal-700 underline">
                    Log maintenance
                  </button>
                </div>
              </div>

              {risk && (
                <p className="text-xs text-ink-400 mt-2">
                  {risk.daysSinceLastService !== null ? `${risk.daysSinceLastService} days since last service` : "No service history"}
                  {risk.recentRepairCount > 0 && ` · ${risk.recentRepairCount} recent repair(s)`}
                </p>
              )}

              {logFor === asset.id && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    maintenanceMutation.mutate({ id: asset.id, type: logType, notes: logNotes || undefined });
                  }}
                  className="mt-3 pt-3 border-t border-ink-100 flex gap-2 items-center flex-wrap"
                >
                  <select value={logType} onChange={(e) => setLogType(e.target.value as typeof logType)} className="text-xs border border-ink-200 rounded px-2 py-1">
                    <option value="inspection">Inspection</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="repair">Repair</option>
                  </select>
                  <input
                    placeholder="Notes (optional)"
                    className="text-xs border border-ink-200 rounded px-2 py-1 flex-1"
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                  />
                  <button type="submit" className="btn-primary text-xs px-3 py-1.5">Log</button>
                </form>
              )}

              {asset.maintenanceRecords.length > 0 && (
                <div className="mt-3 pt-3 border-t border-ink-100 text-xs text-ink-500 space-y-1">
                  {asset.maintenanceRecords.map((r) => (
                    <div key={r.id}>
                      <span className="capitalize font-medium">{r.type}</span> — {new Date(r.performedAt).toLocaleDateString()}
                      {r.notes && <span> · {r.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}