import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface AuditLog {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  createdAt: string;
  user?: { email: string; firstName: string; lastName: string };
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs", page],
    queryFn: () => api.get("/audit-logs", { params: { page } }).then((r) => r.data),
  });

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Audit Logs</h1>
      <p className="text-slate-500 text-sm mb-6">Every sensitive read/write action, for compliance review.</p>

      <div className="bg-white border rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Resource</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td></tr>}
            {logs?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No audit entries yet.</td></tr>}
            {logs?.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                <td className="px-4 py-2 text-slate-500">{log.resourceType ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="border rounded-lg px-3 py-1 text-sm disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-slate-500 self-center">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={(logs?.length ?? 0) < 50}
          className="border rounded-lg px-3 py-1 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}