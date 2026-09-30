import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { PageHeader, StatCard } from "@/components/ui/Primitives";

interface PlatformSummary {
  processUptimeSeconds: number;
  activeHospitals: number;
  activeUsers: number;
  aiRequestsLast24h: number;
  activeSubscriptions: number;
  checkedAt: string;
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function MonitoringPage() {
  const { data, isLoading, isError } = useQuery<PlatformSummary>({
    queryKey: ["monitoring-summary"],
    queryFn: () => api.get("/monitoring/summary").then((r) => r.data),
    refetchInterval: 30000,
  });

  if (isError) {
    return (
      <div className="p-8">
        <p className="text-sm text-rose-600">Super admin access required.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader title="Platform Monitoring" description="Live snapshot across all hospitals on this HealthOS instance." />
      {isLoading && <p className="text-sm text-ink-400">Loading...</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <StatCard icon="🟢" label="Backend uptime" value={formatUptime(data.processUptimeSeconds)} tone="green" />
            <StatCard icon="🏥" label="Active hospitals" value={data.activeHospitals} tone="brand" />
            <StatCard icon="👥" label="Active users" value={data.activeUsers} tone="brand" />
            <StatCard icon="🤖" label="AI requests (24h)" value={data.aiRequestsLast24h} tone="accent" />
            <StatCard icon="💼" label="Active subscriptions" value={data.activeSubscriptions} tone="green" />
          </div>
          <p className="text-xs text-ink-400">Last checked: {new Date(data.checkedAt).toLocaleTimeString()} · auto-refreshes every 30s</p>
        </>
      )}
    </div>
  );
}