import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "@/api/client";

interface HospitalMembership {
  id: string;
  name: string;
  role: string;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  hospitals: HospitalMembership[];
  activeHospitalId: string | null;
  login: (email: string, password: string) => Promise<{ needsHospitalSelection: boolean; mfaRequired?: boolean; userId?: string }>;
  verifyMfa: (userId: string, token: string) => Promise<{ needsHospitalSelection: boolean }>;
  selectHospital: (hospitalId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hospitals, setHospitals] = useState<HospitalMembership[]>([]);
  const [activeHospitalId, setActiveHospitalId] = useState<string | null>(null);

  function applyLoginResult(data: { token: string; user: AuthUser; hospitals: HospitalMembership[] }) {
    localStorage.setItem("healthos_token", data.token);
    setUser(data.user);
    setHospitals(data.hospitals);

    if (data.user.isSuperAdmin || data.hospitals.length !== 1) {
      return { needsHospitalSelection: !data.user.isSuperAdmin && data.hospitals.length > 1 };
    }
    setActiveHospitalId(data.hospitals[0].id);
    return { needsHospitalSelection: false };
  }

  async function login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.mfaRequired) {
      return { needsHospitalSelection: false, mfaRequired: true, userId: data.userId };
    }
    return applyLoginResult(data);
  }

  async function verifyMfa(userId: string, token: string) {
    const { data } = await api.post("/auth/mfa/verify-login", { userId, token });
    return applyLoginResult(data);
  }

  async function selectHospital(hospitalId: string) {
    const { data } = await api.post("/auth/select-hospital", { hospitalId });
    localStorage.setItem("healthos_token", data.token);
    setActiveHospitalId(hospitalId);
  }

  function logout() {
    localStorage.removeItem("healthos_token");
    setUser(null);
    setHospitals([]);
    setActiveHospitalId(null);
  }

  return (
    <AuthContext.Provider value={{ user, hospitals, activeHospitalId, login, verifyMfa, selectHospital, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}