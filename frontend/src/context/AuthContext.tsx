import { createContext, useContext, useState, useEffect, ReactNode } from "react";
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

interface RegisterInput {
  hospitalCode: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  hospitals: HospitalMembership[];
  activeHospitalId: string | null;
  permissions: string[];
  isRestoring: boolean;
  hasPermission: (resource: string) => boolean;
  login: (email: string, password: string) => Promise<{ needsHospitalSelection: boolean; mfaRequired?: boolean; userId?: string }>;
  verifyMfa: (userId: string, token: string) => Promise<{ needsHospitalSelection: boolean }>;
  selectHospital: (hospitalId: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ needsHospitalSelection: boolean }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hospitals, setHospitals] = useState<HospitalMembership[]>([]);
  const [activeHospitalId, setActiveHospitalId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);

  async function loadPermissions() {
    try {
      const { data } = await api.get("/auth/permissions");
      setPermissions(data.permissions);
    } catch {
      setPermissions([]);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("healthos_token");
    if (!token) {
      setIsRestoring(false);
      return;
    }
    api
      .get("/auth/me")
      .then(async ({ data }) => {
        setUser(data.user);
        setHospitals(data.hospitals);
        setActiveHospitalId(data.activeHospitalId);
        if (data.activeHospitalId || data.user.isSuperAdmin) await loadPermissions();
      })
      .catch(() => {
        localStorage.removeItem("healthos_token");
      })
      .finally(() => setIsRestoring(false));
  }, []);

  async function applyLoginResult(data: { token: string; user: AuthUser; hospitals: HospitalMembership[] }) {
    localStorage.setItem("healthos_token", data.token);
    setUser(data.user);
    setHospitals(data.hospitals);

    if (data.user.isSuperAdmin) {
      await loadPermissions();
      return { needsHospitalSelection: false };
    }
    if (data.hospitals.length !== 1) {
      return { needsHospitalSelection: data.hospitals.length > 1 };
    }
    setActiveHospitalId(data.hospitals[0].id);
    await loadPermissions();
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
    await loadPermissions();
  }

  async function register(input: RegisterInput) {
    const { data } = await api.post("/portal/register", input);
    return applyLoginResult(data);
  }

  function logout() {
    localStorage.removeItem("healthos_token");
    setUser(null);
    setHospitals([]);
    setActiveHospitalId(null);
    setPermissions([]);
  }

  function hasPermission(resource: string) {
    return permissions.includes("*") || permissions.some((p) => p.startsWith(`${resource}:`));
  }

  return (
    <AuthContext.Provider
      value={{
        user, hospitals, activeHospitalId, permissions, isRestoring,
        hasPermission, login, verifyMfa, selectHospital, register, logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}