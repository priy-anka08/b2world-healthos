import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const navGroups: { label: string; links: { to: string; label: string; icon: string }[] }[] = [
  { label: "Overview", links: [{ to: "/dashboard", label: "Dashboard", icon: "📊" }] },
  {
    label: "Clinical",
    links: [
      { to: "/patients", label: "Patients", icon: "🧑‍🤝‍🧑" },
      { to: "/appointments", label: "Appointments", icon: "📅" },
      { to: "/admin/doctors", label: "Doctors", icon: "🩺" },
      { to: "/beds", label: "Beds", icon: "🛏️" },
      { to: "/laboratory", label: "Lab", icon: "🧪" },
    ],
  },
  {
    label: "Operations",
    links: [
      { to: "/pharmacy", label: "Pharmacy", icon: "💊" },
      { to: "/inventory", label: "Inventory", icon: "📦" },
      { to: "/billing", label: "Billing", icon: "💳" },
      { to: "/staff", label: "Staff", icon: "👥" },
      { to: "/assets", label: "Assets", icon: "🖥️" },
      { to: "/suppliers", label: "Suppliers", icon: "🚚" },
      { to: "/departments", label: "Departments", icon: "🏢" },
    ],
  },
  {
    label: "AI Tools",
    links: [
      { to: "/ai-tools", label: "AI Copilot", icon: "🤖" },
      { to: "/document-ocr", label: "Document OCR", icon: "🧾" },
      { to: "/predictions", label: "Predictions", icon: "📈" },
    ],
  },
  {
    label: "Admin",
    links: [
      { to: "/documents", label: "Documents", icon: "📄" },
      { to: "/notifications", label: "Notifications", icon: "🔔" },
      { to: "/reports", label: "Reports", icon: "📑" },
      { to: "/audit-logs", label: "Audit Logs", icon: "🧭" },
      { to: "/subscriptions", label: "Subscriptions", icon: "💼" },
      { to: "/security", label: "Security", icon: "🔒" },
    ],
  },
  { label: "Patient", links: [{ to: "/portal", label: "My Portal", icon: "🗂️" }] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <aside className="w-64 shrink-0 bg-sidebar-gradient text-ink-100 flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏥</span>
            <div>
              <div className="font-bold text-white leading-tight bg-gradient-to-r from-brand-300 to-accent-300 bg-clip-text text-transparent">
                B2World
              </div>
              <div className="text-xs text-ink-400 leading-tight">HealthOS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300/70">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-glow"
                          : "text-ink-300 hover:bg-white/5 hover:text-white"
                      }`
                    }
                  >
                    <span className="text-base leading-none">{l.icon}</span>
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-xs text-ink-400 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-1 w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium text-ink-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}