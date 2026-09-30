import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api/client";

// requiredPermission matches the backend's requirePermission(resource, ...)
// string for that module. undefined = always visible (no gate needed).
const navGroups: { label: string; links: { to: string; label: string; icon: string; requiredPermission?: string }[] }[] = [
  { label: "Overview", links: [{ to: "/dashboard", label: "Dashboard", icon: "📊" }] },
  {
    label: "Clinical",
    links: [
      { to: "/patients", label: "Patients", icon: "🧑‍🤝‍🧑", requiredPermission: "patients" },
      { to: "/appointments", label: "Appointments", icon: "📅", requiredPermission: "appointments" },
      { to: "/admin/doctors", label: "Doctors", icon: "🩺", requiredPermission: "practitioners" },
      { to: "/beds", label: "Beds", icon: "🛏️", requiredPermission: "beds" },
      { to: "/laboratory", label: "Lab", icon: "🧪", requiredPermission: "laboratory" },
    ],
  },
  {
    label: "Operations",
    links: [
      { to: "/pharmacy", label: "Pharmacy", icon: "💊", requiredPermission: "pharmacy" },
      { to: "/inventory", label: "Inventory", icon: "📦", requiredPermission: "inventory" },
      { to: "/billing", label: "Billing", icon: "💳", requiredPermission: "billing" },
      { to: "/staff", label: "Staff", icon: "👥", requiredPermission: "staff" },
      { to: "/assets", label: "Assets", icon: "🖥️", requiredPermission: "assets" },
      { to: "/suppliers", label: "Suppliers", icon: "🚚", requiredPermission: "inventory" },
      { to: "/departments", label: "Departments", icon: "🏢", requiredPermission: "departments" },
    ],
  },
  {
    label: "AI Tools",
    links: [
      { to: "/ai-tools", label: "AI Copilot", icon: "🤖", requiredPermission: "ai_copilot" },
      { to: "/document-ocr", label: "Document OCR", icon: "🧾", requiredPermission: "ai_ocr" },
      { to: "/ai-rag", label: "RAG Assistant", icon: "📚", requiredPermission: "ai_rag" },
      { to: "/predictions", label: "Predictions", icon: "📈" },
    ],
  },
  {
    label: "Admin",
    links: [
      { to: "/documents", label: "Documents", icon: "📄", requiredPermission: "documents" },
      { to: "/notifications", label: "Notifications", icon: "🔔" },
      { to: "/reports", label: "Reports", icon: "📑", requiredPermission: "reports" },
      { to: "/audit-logs", label: "Audit Logs", icon: "🧭", requiredPermission: "audit_logs" },
      { to: "/security", label: "Security", icon: "🔒" },
    ],
  },
  
];

interface Branding {
  hospitalName: string;
  branding: { logoEmoji?: string; primaryColorHex?: string; displayName?: string };
}

export default function AppLayout() {
  const { user, hospitals, activeHospitalId, hasPermission, logout } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();
  const currentRole = hospitals.find((h) => h.id === activeHospitalId)?.role;

  const { data: brandingData } = useQuery<Branding>({
    queryKey: ["hospital-branding", activeHospitalId],
    queryFn: () => api.get(`/hospitals/${activeHospitalId}/branding`).then((r) => r.data),
    enabled: !!activeHospitalId,
  });

  const displayName = brandingData?.branding?.displayName || "B2World";
  const logoEmoji = brandingData?.branding?.logoEmoji || "🏥";
  const primaryColor = brandingData?.branding?.primaryColorHex;

  // Filter every nav link by the viewer's actual permissions, then add the
  // two role-gated extras (Branding for hospital admins, Monitoring +
  // Subscriptions for super admins), then drop any group left with 0 links.
  const groups = navGroups
    .map((g) => ({
      ...g,
      links: g.links.filter((l) => !l.requiredPermission || hasPermission(l.requiredPermission)),
    }))
    .map((g) =>
      g.label === "Admin"
        ? {
            ...g,
            links: [
              ...g.links,
              ...(currentRole === "HOSPITAL_ADMIN" ? [{ to: "/settings/branding", label: "Branding", icon: "🎨" }] : []),
              ...(user?.isSuperAdmin
                ? [
                    { to: "/monitoring", label: "Monitoring", icon: "📡" },
                    { to: "/subscriptions", label: "Subscriptions", icon: "💼" },
                    { to: "/admin/onboarding", label: "Onboarding", icon: "🏥" },
                  ]
                : []),
            ],
          }
        : g
    )
    .filter((g) => g.links.length > 0);

  if (currentRole === "PATIENT") {
    groups.push({ label: "Patient", links: [{ to: "/portal", label: "My Portal", icon: "🗂️" }] });
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <aside className="w-64 shrink-0 bg-sidebar-gradient text-ink-100 flex flex-col h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">{logoEmoji}</span>
            <div>
              <div className="font-bold text-white leading-tight bg-gradient-to-r from-brand-300 to-accent-300 bg-clip-text text-transparent">
                {displayName}
              </div>
              <div className="text-xs text-ink-400 leading-tight">HealthOS</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300/70">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    style={({ isActive }) => (isActive && primaryColor ? { background: primaryColor } : undefined)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all ${
                        isActive
                          ? primaryColor
                            ? "text-white shadow-glow"
                            : "bg-gradient-to-r from-brand-600 to-accent-600 text-white shadow-glow"
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