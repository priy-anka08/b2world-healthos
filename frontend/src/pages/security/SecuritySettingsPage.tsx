import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";

export default function SecuritySettingsPage() {
  const [step, setStep] = useState<"idle" | "setup" | "enabled">("idle");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setupMutation = useMutation({
    mutationFn: () => api.post("/auth/mfa/setup").then((r) => r.data),
    onSuccess: (data) => {
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStep("setup");
    },
  });

  const enableMutation = useMutation({
    mutationFn: () => api.post("/auth/mfa/enable", { token }).then((r) => r.data),
    onSuccess: () => {
      setStep("enabled");
      setError(null);
    },
    onError: () => setError("Invalid code — check your authenticator app and try again."),
  });

  const disableMutation = useMutation({
    mutationFn: () => api.post("/auth/mfa/disable", { token }).then((r) => r.data),
    onSuccess: () => {
      setStep("idle");
      setToken("");
      setError(null);
    },
    onError: () => setError("Invalid code."),
  });

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Security</h1>
      <p className="text-slate-500 text-sm mb-6">Two-factor authentication (TOTP) for your account.</p>

      <div className="bg-white border rounded-xl p-6">
        {step === "idle" && (
          <>
            <p className="text-sm text-slate-600 mb-4">MFA is not currently enabled on this account.</p>
            <button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {setupMutation.isPending ? "Setting up..." : "Set up MFA"}
            </button>
          </>
        )}

        {step === "setup" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Add this to your authenticator app (Google Authenticator, Authy, etc.) — either scan a QR from the
              URL below or enter the secret manually.
            </p>
            <div className="bg-slate-50 rounded p-3 text-xs break-all font-mono">{secret}</div>
            <p className="text-xs text-slate-400 break-all">{otpauthUrl}</p>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <input
              placeholder="Enter the 6-digit code to confirm"
              maxLength={6}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            />
            <button
              onClick={() => enableMutation.mutate()}
              disabled={enableMutation.isPending || token.length !== 6}
              className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {enableMutation.isPending ? "Confirming..." : "Confirm and enable"}
            </button>
          </div>
        )}

        {step === "enabled" && (
          <div className="space-y-3">
            <p className="text-sm text-green-700">✓ MFA is enabled on this account.</p>
            {error && <div className="text-sm text-red-600">{error}</div>}
            <input
              placeholder="Enter a code to disable MFA"
              maxLength={6}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
            />
            <button
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending || token.length !== 6}
              className="border border-red-300 text-red-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {disableMutation.isPending ? "Disabling..." : "Disable MFA"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}