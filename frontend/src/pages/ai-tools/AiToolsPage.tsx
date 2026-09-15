import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
}

interface DocDraft {
  chiefComplaint?: string;
  history?: string;
  observations?: string;
  assessment?: string;
  plan?: string;
}

export default function AiToolsPage() {
  // --- Documentation assistant ---
  const [rawNotes, setRawNotes] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const draftMutation = useMutation({
    mutationFn: () => api.post("/ai/documentation/draft", { encounterId, rawNotes }).then((r) => r.data),
  });

  // --- Clinical summary ---
  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });
  const [summaryPatientId, setSummaryPatientId] = useState("");
  const summaryMutation = useMutation({
    mutationFn: () => api.get(`/ai/summary/patient/${summaryPatientId}`).then((r) => r.data),
  });

  // --- Copilot ---
  const [question, setQuestion] = useState("");
  const copilotMutation = useMutation({
    mutationFn: () => api.post("/ai/copilot/query", { question }).then((r) => r.data),
  });

  const draft: DocDraft | null =
    draftMutation.data?.draft && typeof draftMutation.data.draft === "object" ? draftMutation.data.draft : null;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">AI Tools</h1>
      <p className="text-slate-500 text-sm mb-6">
        Self-hosted (Ollama) assistants — all outputs are advisory drafts, never auto-saved to the record.
      </p>

      {/* Documentation Assistant */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-1">Documentation Assistant</h2>
        <p className="text-xs text-slate-500 mb-3">
          Paste rough consultation notes → get a structured draft. You still save the official note yourself
          from the Appointments → Start Consultation panel — this only drafts it.
        </p>
        <input
          placeholder="Encounter ID (from an in-progress consultation)"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
          value={encounterId}
          onChange={(e) => setEncounterId(e.target.value)}
        />
        <textarea
          placeholder="e.g. pt c/o fever 2 days, no cough, temp 100.4, likely viral, advised rest and paracetamol"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
          rows={3}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
        />
        <button
          onClick={() => draftMutation.mutate()}
          disabled={draftMutation.isPending || !encounterId || !rawNotes}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {draftMutation.isPending ? "Drafting..." : "Draft note"}
        </button>

        {draftMutation.isError && (
          <p className="text-xs text-red-600 mt-2">
            Couldn't draft — check the encounter ID belongs to this hospital, or that Ollama has a model pulled.
          </p>
        )}

        {draft && (
          <div className="mt-4 pt-4 border-t text-sm space-y-1 bg-slate-50 rounded p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">{draftMutation.data.disclaimer}</p>
            {draft.chiefComplaint && <div><b>Chief complaint:</b> {draft.chiefComplaint}</div>}
            {draft.history && <div><b>History:</b> {draft.history}</div>}
            {draft.observations && <div><b>Observations:</b> {draft.observations}</div>}
            {draft.assessment && <div><b>Assessment:</b> {draft.assessment}</div>}
            {draft.plan && <div><b>Plan:</b> {draft.plan}</div>}
          </div>
        )}
      </div>

      {/* Clinical Summary */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-1">Clinical Summary</h2>
        <p className="text-xs text-slate-500 mb-3">Summarizes a patient's recorded visit history.</p>
        <div className="flex gap-2">
          <select
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            value={summaryPatientId}
            onChange={(e) => setSummaryPatientId(e.target.value)}
          >
            <option value="">Select patient…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.patientCode})
              </option>
            ))}
          </select>
          <button
            onClick={() => summaryMutation.mutate()}
            disabled={summaryMutation.isPending || !summaryPatientId}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {summaryMutation.isPending ? "Summarizing..." : "Summarize"}
          </button>
        </div>

        {summaryMutation.data && (
          <div className="mt-4 pt-4 border-t text-sm bg-slate-50 rounded p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">{summaryMutation.data.disclaimer}</p>
            <p>{summaryMutation.data.summary}</p>
            <p className="text-xs text-slate-400 mt-2">
              Based on {summaryMutation.data.basedOnEncounters} recorded encounter(s).
            </p>
          </div>
        )}
      </div>

      {/* Copilot */}
      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-1">HealthOS Copilot</h2>
        <p className="text-xs text-slate-500 mb-3">
          Ask about this hospital's current operational data (patients, appointments, stock, beds, billing).
        </p>
        <div className="flex gap-2">
          <input
            placeholder="e.g. How many beds are available right now?"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            onClick={() => copilotMutation.mutate()}
            disabled={copilotMutation.isPending || !question}
            className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {copilotMutation.isPending ? "Asking..." : "Ask"}
          </button>
        </div>

        {copilotMutation.data && (
          <div className="mt-4 pt-4 border-t text-sm bg-slate-50 rounded p-3">
            <p>{copilotMutation.data.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}