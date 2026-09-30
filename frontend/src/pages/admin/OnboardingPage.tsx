import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalCode, setHospitalCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data: organizations } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: () => api.get("/organizations").then((r) => r.data),
  });

  const onboardMutation = useMutation({
    mutationFn: async () => {
      let organizationId = orgId;
      if (mode === "new") {
        const { data: org } = await api.post("/organizations", { name: orgName, slug: orgSlug });
        organizationId = org.id;
      }
      const { data: hospital } = await api.post("/hospitals", {
        organizationId, name: hospitalName, code: hospitalCode, address: address || undefined, phone: phone || undefined,
      });
      return hospital;
    },
    onSuccess: (hospital) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setSuccess(`Hospital "${hospital.name}" (code: ${hospital.code}) is live.`);
      setError(null);
      setHospitalName(""); setHospitalCode(""); setAddress(""); setPhone("");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error ?? "Onboarding failed");
    },
  });

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-1">Hospital Onboarding</h1>
      <p className="text-slate-500 text-sm mb-6">Spin up a new hospital on the platform (Phase 6).</p>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {success && <p className="text-sm text-teal-700 bg-teal-50 rounded-lg px-3 py-2 mb-3">{success}</p>}

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Organization</label>
          <div className="flex gap-2 mb-2">
            <button onClick={() => setMode("new")} className={`text-xs rounded-full px-3 py-1 ${mode === "new" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>New organization</button>
            <button onClick={() => setMode("existing")} className={`text-xs rounded-full px-3 py-1 ${mode === "existing" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>Existing organization</button>
          </div>
          {mode === "new" ? (
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Organization name" className="border rounded-lg px-3 py-2 text-sm" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              <input placeholder="slug (lowercase-dashes)" className="border rounded-lg px-3 py-2 text-sm" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value.toLowerCase())} />
            </div>
          ) : (
            <select className="border rounded-lg px-3 py-2 text-sm w-full" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Select organization…</option>
              {organizations?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Hospital details</label>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Hospital name" className="border rounded-lg px-3 py-2 text-sm col-span-2" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
            <input placeholder="Code (e.g. APOLLO-01)" className="border rounded-lg px-3 py-2 text-sm" value={hospitalCode} onChange={(e) => setHospitalCode(e.target.value.toUpperCase())} />
            <input placeholder="Phone" className="border rounded-lg px-3 py-2 text-sm" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input placeholder="Address" className="border rounded-lg px-3 py-2 text-sm col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <button
          onClick={() => onboardMutation.mutate()}
          disabled={onboardMutation.isPending || !hospitalName || !hospitalCode || (mode === "new" ? !orgName || !orgSlug : !orgId)}
          className="btn-primary w-full"
        >
          {onboardMutation.isPending ? "Creating..." : "Onboard hospital"}
        </button>
      </div>
    </div>
  );
}