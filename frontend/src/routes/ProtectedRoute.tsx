import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("healthos_token");
  const { isRestoring } = useAuth();

  if (!token) return <Navigate to="/login" replace />;

  // Token exists but AuthContext hasn't finished restoring user/hospitals
  // from /auth/me yet — render nothing for a moment instead of showing a
  // sidebar with a blank name/role (which is exactly the bug we're fixing).
  if (isRestoring) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-ink-400">Loading...</div>;
  }

  return <>{children}</>;
}