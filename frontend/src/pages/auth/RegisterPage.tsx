import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

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
            Book appointments, <br /> view your records — all in one place.
          </h2>
          <p className="text-brand-200 text-sm max-w-sm">
            Create a patient account to access your appointments, prescriptions, lab reports, and bills
            for a specific hospital.
          </p>
        </div>
        <p className="text-xs text-brand-300/70">© {new Date().getFullYear()} B2World HealthOS</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">{children}</div>
    </div>
  );
}

const emptyForm = { hospitalCode: "", firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "" };

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await register({
        hospitalCode: form.hospitalCode,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      navigate("/dashboard");
    } catch (err) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Couldn't create your account. Check the hospital code and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleSubmit} className="w-full max-w-sm card p-8 space-y-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Create your account</h1>
          <p className="text-sm text-ink-500">Patient portal — ask your hospital for their code (e.g. DEMO-01).</p>
        </div>
        {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}

        <input
          required
          placeholder="Hospital code"
          className="input"
          value={form.hospitalCode}
          onChange={(e) => setForm({ ...form, hospitalCode: e.target.value.toUpperCase() })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            placeholder="First name"
            className="input"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            required
            placeholder="Last name"
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
        <input
          type="email"
          required
          placeholder="Email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          placeholder="Phone (optional)"
          className="input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 characters)"
          className="input"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <input
          type="password"
          required
          placeholder="Confirm password"
          className="input"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />

        <button type="submit" disabled={submitting} className="btn-brand w-full">
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <Link to="/login" className="text-sm text-teal-700 hover:text-teal-900 w-full block text-center">
          Already have an account? Sign in
        </Link>
      </form>
    </AuthShell>
  );
}