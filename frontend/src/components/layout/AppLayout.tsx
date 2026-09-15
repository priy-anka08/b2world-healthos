import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/appointments", label: "Appointments" },
  { to: "/beds", label: "Beds" },
  { to: "/laboratory", label: "Lab" },
  { to: "/pharmacy", label: "Pharmacy" },
  { to: "/billing", label: "Billing" },
  { to: "/staff", label: "Staff" },
  { to: "/assets", label: "Assets" },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/departments", label: "Departments" },
  { to: "/documents", label: "Documents" },
  { to: "/notifications", label: "Notifications" },
  { to: "/reports", label: "Reports" },
  { to: "/audit-logs", label: "Audit Logs" },
  { to: "/ai-tools", label: "AI Tools" },
  { to: "/predictions", label: "Predictions" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/security", label: "Security" },
  { to: "/portal", label: "My Portal" },
  { to: "/admin/doctors", label: "Doctors" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-bold">B2World HealthOS</span>
            <nav className="flex gap-3 flex-wrap">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `text-sm px-2 py-1 rounded ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user?.email}</span>
            <button onClick={logout} className="text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}