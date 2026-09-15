import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

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

const emptyForm = { name: "", category: "Other", location: "" };

const statusColor: Record<string, string> = {
  operational: "bg-green-100 text-green-800",
  maintenance: "bg-amber-100 text-amber-800",
  decommissioned: "bg-slate-200 text-slate-600",
};

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-slate-500 text-sm">{assets?.length ?? 0} pieces of equipment</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add asset"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg">
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="Asset name (e.g. Ventilator #3)" className="border rounded-lg px-3 py-2 col-span-2"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="border rounded-lg px-3 py-2" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="CT">CT Scanner</option>
              <option value="MRI">MRI</option>
              <option value="X-Ray">X-Ray</option>
              <option value="Ultrasound">Ultrasound</option>
              <option value="Ventilator">Ventilator</option>
              <option value="Monitor">Monitor</option>
              <option value="Other">Other</option>
            </select>
            <input placeholder="Location" className="border rounded-lg px-3 py-2"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <button type="submit" disabled={createMutation.isPending}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Saving..." : "Save asset"}
          </button>
        </form>
      )}

      {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
      {assets?.length === 0 && !isLoading && <p className="text-slate-400 text-sm">No assets yet — add one above.</p>}

      <div className="space-y-3">
        {assets?.map((asset) => (
          <div key={asset.id} className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{asset.name}</div>
                <div className="text-xs text-slate-500">{asset.category} {asset.location && `· ${asset.location}`}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs rounded-full px-2 py-1 capitalize ${statusColor[asset.status] ?? "bg-slate-100"}`}>
                  {asset.status}
                </span>
                <select
                  value={asset.status}
                  onChange={(e) => statusMutation.mutate({ id: asset.id, status: e.target.value })}
                  className="text-xs border rounded px-2 py-1"
                >
                  <option value="operational">Operational</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
                <button onClick={() => setLogFor(logFor === asset.id ? null : asset.id)} className="text-xs text-blue-600 underline">
                  Log maintenance
                </button>
              </div>
            </div>

            {logFor === asset.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  maintenanceMutation.mutate({ id: asset.id, type: logType, notes: logNotes || undefined });
                }}
                className="mt-3 pt-3 border-t flex gap-2 items-center"
              >
                <select value={logType} onChange={(e) => setLogType(e.target.value as typeof logType)} className="text-xs border rounded px-2 py-1">
                  <option value="inspection">Inspection</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="repair">Repair</option>
                </select>
                <input
                  placeholder="Notes (optional)"
                  className="text-xs border rounded px-2 py-1 flex-1"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                />
                <button type="submit" className="text-xs bg-slate-900 text-white rounded px-3 py-1">
                  Log
                </button>
              </form>
            )}

            {asset.maintenanceRecords.length > 0 && (
              <div className="mt-3 pt-3 border-t text-xs text-slate-500 space-y-1">
                {asset.maintenanceRecords.map((r) => (
                  <div key={r.id}>
                    <span className="capitalize font-medium">{r.type}</span> — {new Date(r.performedAt).toLocaleDateString()}
                    {r.notes && <span> · {r.notes}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}