import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

// Defense-in-depth: hiding a nav link stops casual clicks, but someone
// could still type the URL directly. This wraps a route's element and
// blocks rendering it at all if the current role lacks the permission —
// same resource strings used by the sidebar filter and the backend's
// requirePermission(resource, action).
export default function RequirePermission({ resource, children }: { resource: string; children: ReactNode }) {
  const { user, hasPermission } = useAuth();

  if (user?.isSuperAdmin || hasPermission(resource)) {
    return <>{children}</>;
  }

  return (
    <div className="p-8 max-w-md">
      <div className="card p-6 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <h1 className="text-lg font-bold text-ink-900 mb-1">Access restricted</h1>
        <p className="text-sm text-ink-500 mb-4">
          Your role doesn't have permission to view this page. If you think this is a mistake, ask your hospital
          admin.
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}