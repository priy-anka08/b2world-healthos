import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login, hospitals, selectHospital, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsHospitalPick, setNeedsHospitalPick] = useState(false);
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await login(email, password);
      if (result.mfaRequired) {
        setMfaUserId(result.userId!);
      } else if (result.needsHospitalSelection) {
        setNeedsHospitalPick(true);
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
      if (result.needsHospitalSelection) {
        setNeedsHospitalPick(true);
      } else {
        navigate("/dashboard");
      }
    } catch {
      setError("Invalid code. Try again.");
    }
  }

  async function handleHospitalPick(hospitalId: string) {
    await selectHospital(hospitalId);
    navigate("/dashboard");
  }

  if (mfaUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleMfaSubmit} className="w-full max-w-sm bg-white shadow rounded-xl p-8 space-y-4">
          <div>
            <h1 className="text-xl font-bold">Two-factor verification</h1>
            <p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <input
            type="text"
            required
            maxLength={6}
            placeholder="123456"
            className="w-full border rounded-lg px-3 py-2 text-center tracking-widest text-lg"
            value={mfaToken}
            onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ""))}
          />
          <button type="submit" className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium">
            Verify
          </button>
        </form>
      </div>
    );
  }

  if (needsHospitalPick) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm space-y-3">
          <h2 className="text-lg font-semibold">Select a hospital</h2>
          {hospitals.map((h) => (
            <button
              key={h.id}
              onClick={() => handleHospitalPick(h.id)}
              className="w-full text-left border rounded-lg p-3 hover:bg-slate-100"
            >
              <div className="font-medium">{h.name}</div>
              <div className="text-sm text-slate-500">{h.role}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white shadow rounded-xl p-8 space-y-4">
        <div>
          <h1 className="text-xl font-bold">B2World HealthOS</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <input
          type="email"
          required
          placeholder="Email"
          className="w-full border rounded-lg px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          placeholder="Password"
          className="w-full border rounded-lg px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium">
          Sign in
        </button>
      </form>
    </div>
  );
}