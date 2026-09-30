import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api/client";

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-ink-50">
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar-gradient text-white flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏥</span>
          <span className="font-bold text-lg bg-gradient-to-r from-brand-200 to-accent-200 bg-clip-text text-transparent">
            B2World HealthOS
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight mb-3">
            One platform to run <br /> your entire hospital.
          </h2>
          <p className="text-brand-200 text-sm max-w-sm">
            Patients, appointments, beds, pharmacy, billing, lab — plus a self-hosted AI layer for
            documentation, OCR, and operational insight.
          </p>
        </div>
        <p className="text-xs text-brand-300/70">© {new Date().getFullYear()} B2World HealthOS</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">{children}</div>
    </div>
  );
}

type View = "login" | "mfa" | "hospital-pick" | "forgot" | "reset";

export default function LoginPage() {
  const { login, hospitals, selectHospital, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login(email, password);
      if (result.mfaRequired) {
        setMfaUserId(result.userId!);
        setView("mfa");
      } else if (result.needsHospitalSelection) {
        setView("hospital-pick");
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Invalid email or password.");
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await verifyMfa(mfaUserId!, mfaToken);
      if (result.needsHospitalSelection) setView("hospital-pick");
      else navigate("/dashboard");
    } catch {
      setError("Invalid code. Try again.");
    }
  }

  async function handleHospitalPick(hospitalId: string) {
    await selectHospital(hospitalId);
    navigate("/dashboard");
  }

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setInfo(data.message);
      if (data.devModeResetToken) {
        setResetToken(data.devModeResetToken);
        setInfo(`${data.message} (${data.devModeNote})`);
        setView("reset");
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      await api.post("/auth/reset-password", { resetToken, newPassword });
      setInfo("Password reset. You can sign in now.");
      setPassword("");
      setResetToken("");
      setNewPassword("");
      setView("login");
    } catch {
      setError("That reset link is invalid or has expired — request a new one.");
    }
  }

  if (view === "mfa") {
    return (
      <AuthShell>
        <form onSubmit={handleMfaSubmit} className="w-full max-w-sm card p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold">Two-factor verification</h1>
            <p className="text-sm text-ink-500">Enter the 6-digit code from your authenticator app.</p>
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <input
            type="text"
            required
            maxLength={6}
            placeholder="123456"
            className="input text-center tracking-widest text-lg"
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" className="btn-brand w-full">Verify</button>
        </form>
      </AuthShell>
    );
  }

  if (view === "hospital-pick") {
    return (
      <AuthShell>
        <div className="w-full max-w-sm space-y-3">
          <h2 className="text-lg font-semibold">Select a hospital</h2>
          {hospitals.map((h) => (
            <button key={h.id} onClick={() => handleHospitalPick(h.id)} className="w-full text-left card card-hover p-4">
              <div className="font-medium text-ink-900">{h.name}</div>
              <div className="text-sm text-ink-500">{h.role}</div>
            </button>
          ))}
        </div>
      </AuthShell>
    );
  }

  if (view === "forgot") {
    return (
      <AuthShell>
        <form onSubmit={handleForgotSubmit} className="w-full max-w-sm card p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">Reset your password</h1>
            <p className="text-sm text-ink-500">Enter your account email.</p>
          </div>
          {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
          {info && <div className="text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2">{info}</div>}
          <input type="email" required placeholder="Email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="btn-brand w-full">Send reset link</button>
          <button type="button" onClick={() => setView("login")} className="text-sm text-ink-500 hover:text-ink-800 w-full text-center">
            Back to sign in
          </button>
        </form>
      </AuthShell>
    );
  }

  if (view === "reset") {
    return (
      <AuthShell>
        <form onSubmit={handleResetSubmit} className="w-full max-w-sm card p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold text-ink-900">Set a new password</h1>
            <p className="text-sm text-ink-500">Paste your reset token and choose a new password.</p>
          </div>
          {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
          {info && <div className="text-xs text-teal-700 bg-teal-50 rounded-lg px-3 py-2 break-all">{info}</div>}
          <textarea
            required
            placeholder="Reset token"
            className="input text-xs"
            rows={3}
            value={resetToken}
            onChange={(e) => setResetToken(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="submit" className="btn-brand w-full">Reset password</button>
          <button type="button" onClick={() => setView("login")} className="text-sm text-ink-500 hover:text-ink-800 w-full text-center">
            Back to sign in
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full max-w-sm card p-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Welcome back</h1>
          <p className="text-sm text-ink-500">Sign in to B2World HealthOS</p>
        </div>
        {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}
        {info && <div className="text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2">{info}</div>}
        <input type="email" required placeholder="Email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          required
          placeholder="Password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
                <button type="submit" className="btn-brand w-full">Sign in</button>
        <button
          type="button"
          onClick={() => { setError(null); setInfo(null); setView("forgot"); }}
          className="text-sm text-teal-700 hover:text-teal-900 w-full text-center"
        >
          Forgot password?
        </button>
        <Link to="/register" className="text-sm text-ink-500 hover:text-ink-800 w-full block text-center">
          New patient? Create an account
        </Link>
      </form>
    </AuthShell>
  );
}