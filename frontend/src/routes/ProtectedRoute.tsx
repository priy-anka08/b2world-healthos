import { Navigate } from "react-router-dom";
import { ReactNode } from "react";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("healthos_token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
