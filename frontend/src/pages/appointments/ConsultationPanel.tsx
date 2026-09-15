import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface ClinicalNote {
  id: string;
  content: {
    chiefComplaint?: string;
    history?: string;
    observations?: string;
    assessment?: string;
    plan?: string;
  };
  createdAt: string;
}

interface Prescription {
  id: string;
  dosage: string;
  frequency: string;
  durationDays?: number;
  notes?: string;
}

interface Encounter {
  id: string;
  status: string;
  clinicalNotes: ClinicalNote[];
  medicationRequests: Prescription[];
  patient: { firstName: string; lastName: string; patientCode: string };
}

const emptyNoteForm = { chiefComplaint: "", history: "", observations: "", assessment: "", plan: "" };
const emptyRxForm = { dosage: "", frequency: "", durationDays: 5, notes: "" };

export default function ConsultationPanel({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState(emptyNoteForm);
  const [rxForm, setRxForm] = useState(emptyRxForm);
  const [showRxForm, setShowRxForm] = useState(false);

  // Get-or-create the encounter as soon as the panel opens.
  const startMutation = useMutation({
    mutationFn: () => api.post("/encounters/start", { appointmentId }).then((r) => r.data),
    onSuccess: (data) => setEncounterId(data.id),
  });

  if (!encounterId && !startMutation.isPending && !startMutation.data) {
    startMutation.mutate();
  }

  const { data: encounter, isLoading } = useQuery<Encounter>({
    queryKey: ["encounter", encounterId],
    queryFn: () => api.get(`/encounters/${encounterId}`).then((r) => r.data),
    enabled: !!encounterId,
  });

  const invalidateEncounter = () => queryClient.invalidateQueries({ queryKey: ["encounter", encounterId] });

  const noteMutation = useMutation({
    mutationFn: () => api.post("/clinical-notes", { encounterId, ...noteForm }).then((r) => r.data),
    onSuccess: () => {
      invalidateEncounter();
      setNoteForm(emptyNoteForm);
    },
  });

  const rxMutation = useMutation({
    mutationFn: () => api.post("/prescriptions", { encounterId, ...rxForm }).then((r) => r.data),
    onSuccess: () => {
      invalidateEncounter();
      setRxForm(emptyRxForm);
      setShowRxForm(false);
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/encounters/${encounterId}/close`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments-list"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center overflow-y-auto py-8 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-4">
        <div className="flex items-center justify-between mb-4">
                    <div>
            <h2 className="text-lg font-bold">
              Consultation {encounter && `— ${encounter.patient.firstName} ${encounter.patient.lastName}`}
            </h2>
            {encounter && (
              <p className="text-xs text-slate-400 mt-1">
                Encounter ID: <code className="bg-slate-100 px-1 rounded">{encounter.id}</code>{" "}
                <button
                  onClick={() => navigator.clipboard.writeText(encounter.id)}
                  className="text-blue-600 underline"
                >
                  copy
                </button>{" "}
                (use this in AI Tools → Documentation Assistant)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {(isLoading || startMutation.isPending) && <p className="text-sm text-slate-400">Loading encounter...</p>}

        {encounter && (
          <>
            {/* Clinical note */}
            <div className="border rounded-lg p-4 mb-4">
              <h3 className="font-medium text-sm mb-3">Consultation note</h3>
              <div className="space-y-2">
                <input placeholder="Chief complaint" className="w-full border rounded px-3 py-2 text-sm"
                  value={noteForm.chiefComplaint} onChange={(e) => setNoteForm({ ...noteForm, chiefComplaint: e.target.value })} />
                <textarea placeholder="History" className="w-full border rounded px-3 py-2 text-sm" rows={2}
                  value={noteForm.history} onChange={(e) => setNoteForm({ ...noteForm, history: e.target.value })} />
                <textarea placeholder="Observations" className="w-full border rounded px-3 py-2 text-sm" rows={2}
                  value={noteForm.observations} onChange={(e) => setNoteForm({ ...noteForm, observations: e.target.value })} />
                <textarea placeholder="Assessment" className="w-full border rounded px-3 py-2 text-sm" rows={2}
                  value={noteForm.assessment} onChange={(e) => setNoteForm({ ...noteForm, assessment: e.target.value })} />
                <textarea placeholder="Plan" className="w-full border rounded px-3 py-2 text-sm" rows={2}
                  value={noteForm.plan} onChange={(e) => setNoteForm({ ...noteForm, plan: e.target.value })} />
                <button
                  onClick={() => noteMutation.mutate()}
                  disabled={noteMutation.isPending}
                  className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {noteMutation.isPending ? "Saving..." : "Save note"}
                </button>
              </div>

              {encounter.clinicalNotes.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {encounter.clinicalNotes.map((n) => (
                    <div key={n.id} className="text-xs text-slate-600 bg-slate-50 rounded p-3 space-y-1">
                      <div className="text-slate-400">{new Date(n.createdAt).toLocaleString()}</div>
                      {n.content.chiefComplaint && <div><b>CC:</b> {n.content.chiefComplaint}</div>}
                      {n.content.history && <div><b>History:</b> {n.content.history}</div>}
                      {n.content.observations && <div><b>Obs:</b> {n.content.observations}</div>}
                      {n.content.assessment && <div><b>Assessment:</b> {n.content.assessment}</div>}
                      {n.content.plan && <div><b>Plan:</b> {n.content.plan}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescriptions */}
            <div className="border rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm">Prescriptions</h3>
                <button onClick={() => setShowRxForm((v) => !v)} className="text-xs text-blue-600 underline">
                  {showRxForm ? "Cancel" : "+ Add prescription"}
                </button>
              </div>

              {showRxForm && (
                <div className="space-y-2 mb-3">
                  <input placeholder="Medicine + dose (e.g. Paracetamol 500mg)" className="w-full border rounded px-3 py-2 text-sm"
                    value={rxForm.dosage} onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Frequency (e.g. Twice daily)" className="border rounded px-3 py-2 text-sm"
                      value={rxForm.frequency} onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })} />
                    <input type="number" min={1} placeholder="Duration (days)" className="border rounded px-3 py-2 text-sm"
                      value={rxForm.durationDays} onChange={(e) => setRxForm({ ...rxForm, durationDays: Number(e.target.value) })} />
                  </div>
                  <input placeholder="Notes (optional)" className="w-full border rounded px-3 py-2 text-sm"
                    value={rxForm.notes} onChange={(e) => setRxForm({ ...rxForm, notes: e.target.value })} />
                  <button
                    onClick={() => rxMutation.mutate()}
                    disabled={rxMutation.isPending || !rxForm.dosage || !rxForm.frequency}
                    className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {rxMutation.isPending ? "Saving..." : "Save prescription"}
                  </button>
                </div>
              )}

              {encounter.medicationRequests.length === 0 ? (
                <p className="text-xs text-slate-400">No prescriptions yet.</p>
              ) : (
                <ul className="text-xs text-slate-600 space-y-1">
                  {encounter.medicationRequests.map((rx) => (
                    <li key={rx.id}>
                      <b>{rx.dosage}</b> — {rx.frequency}
                      {rx.durationDays && ` · ${rx.durationDays} days`}
                      {rx.notes && ` · ${rx.notes}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="border rounded-lg px-4 py-2 text-sm">
                Close panel
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="bg-green-700 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {closeMutation.isPending ? "Completing..." : "Complete consultation"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}