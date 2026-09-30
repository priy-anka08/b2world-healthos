import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Card } from "@/components/ui/Primitives";

interface Branding {
  hospitalName: string;
  branding: { logoEmoji?: string; primaryColorHex?: string; displayName?: string };
}

export default function BrandingSettingsPage() {
  const { activeHospitalId } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [logoEmoji, setLogoEmoji] = useState("");
  const [primaryColorHex, setPrimaryColorHex] = useState("");

  const { data } = useQuery<Branding>({
    queryKey: ["hospital-branding", activeHospitalId],
    queryFn: () => api.get(`/hospitals/${activeHospitalId}/branding`).then((r) => r.data),
    enabled: !!activeHospitalId,
  });

  useEffect(() => {
    if (data) {
      setDisplayName(data.branding.displayName ?? "");
      setLogoEmoji(data.branding.logoEmoji ?? "");
      setPrimaryColorHex(data.branding.primaryColorHex ?? "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api
        .patch(`/hospitals/${activeHospitalId}/branding`, {
          displayName: displayName || undefined,
          logoEmoji: logoEmoji || undefined,
          primaryColorHex: primaryColorHex || undefined,
        })
        .then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hospital-branding"] }),
  });

  return (
    <div className="p-8 max-w-md">
      <PageHeader title="Branding" description="White-label this hospital's sidebar (spec Phase 6)." />
      <Card>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-ink-500">Display name (replaces "B2World")</label>
            <input className="input mt-1" placeholder="e.g. Apollo Care" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Logo emoji</label>
            <input className="input mt-1" placeholder="🏥" maxLength={4} value={logoEmoji} onChange={(e) => setLogoEmoji(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-500">Primary color (hex)</label>
            <div className="flex items-center gap-2 mt-1">
              <input className="input" placeholder="#5F8F8B" value={primaryColorHex} onChange={(e) => setPrimaryColorHex(e.target.value)} />
              {primaryColorHex && <span className="h-8 w-8 rounded-lg border border-ink-200 shrink-0" style={{ background: primaryColorHex }} />}
            </div>
          </div>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="btn-primary w-full">
            {saveMutation.isPending ? "Saving..." : "Save branding"}
          </button>
          {saveMutation.isSuccess && <p className="text-xs text-teal-700">Saved — refresh the page to see it applied.</p>}
        </div>
      </Card>
    </div>
  );
}