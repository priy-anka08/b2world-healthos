import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications?.filter((n) => !n.readAt).length ?? 0;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Notifications</h1>
      <p className="text-slate-500 text-sm mb-6">{unreadCount} unread</p>

      {isLoading && <p className="text-sm text-slate-400">Loading...</p>}
      {notifications?.length === 0 && !isLoading && <p className="text-sm text-slate-400">No notifications yet.</p>}

      <div className="space-y-2">
        {notifications?.map((n) => (
          <div
            key={n.id}
            className={`bg-white border rounded-xl p-4 flex items-start justify-between ${!n.readAt ? "border-blue-300" : ""}`}
          >
            <div>
              <div className="flex items-center gap-2">
                {!n.readAt && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                <span className="font-medium text-sm">{n.title}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{n.body}</p>
              <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            {!n.readAt && (
              <button onClick={() => markRead.mutate(n.id)} className="text-xs text-blue-600 underline whitespace-nowrap">
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}