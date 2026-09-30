import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { PageHeader, Card } from "@/components/ui/Primitives";

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

interface OrchestratorResult {
  question: string;
  agentsInvoked: string[];
  results: { agent: string; data: unknown }[];
  disclaimer: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // --- Voice assistant ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceMutation = useMutation({
    mutationFn: (audioBase64: string) => api.post("/ai/voice/transcribe", { audioBase64 }).then((r) => r.data),
  });

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const base64 = await blobToBase64(blob);
      voiceMutation.mutate(base64);
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  // --- Multi-agent orchestrator ---
  const [orchestratorQuestion, setOrchestratorQuestion] = useState("");
  const orchestratorMutation = useMutation({
    mutationFn: () => api.post("/ai/orchestrator/query", { question: orchestratorQuestion }).then((r) => r.data as OrchestratorResult),
  });

  const draft: DocDraft | null =
    draftMutation.data?.draft && typeof draftMutation.data.draft === "object" ? draftMutation.data.draft : null;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="AI Tools"
        description="Self-hosted (Ollama) assistants — all outputs are advisory drafts, never auto-saved to the record."
      />

      {/* Documentation Assistant */}
      <Card className="mb-5">
        <h2 className="font-semibold mb-1">Documentation Assistant</h2>
        <p className="text-xs text-ink-500 mb-3">
          Paste rough consultation notes → get a structured draft. You still save the official note yourself
          from Appointments → Start Consultation — this only drafts it.
        </p>
        <input
          placeholder="Encounter ID (from an in-progress consultation)"
          className="input mb-2"
          value={encounterId}
          onChange={(e) => setEncounterId(e.target.value)}
        />
        <textarea
          placeholder="e.g. pt c/o fever 2 days, no cough, temp 100.4, likely viral, advised rest and paracetamol"
          className="input mb-2"
          rows={3}
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
        />
        <button
          onClick={() => draftMutation.mutate()}
          disabled={draftMutation.isPending || !encounterId || !rawNotes}
          className="btn-primary"
        >
          {draftMutation.isPending ? "Drafting..." : "Draft note"}
        </button>

        {draftMutation.isError && (
          <p className="text-xs text-rose-600 mt-2">
            Couldn't draft — check the encounter ID belongs to this hospital, or that Ollama has a model pulled.
          </p>
        )}

        {draft && (
          <div className="mt-4 pt-4 border-t border-ink-100 text-sm space-y-1 bg-ink-50 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">{draftMutation.data.disclaimer}</p>
            {draft.chiefComplaint && <div><b>Chief complaint:</b> {draft.chiefComplaint}</div>}
            {draft.history && <div><b>History:</b> {draft.history}</div>}
            {draft.observations && <div><b>Observations:</b> {draft.observations}</div>}
            {draft.assessment && <div><b>Assessment:</b> {draft.assessment}</div>}
            {draft.plan && <div><b>Plan:</b> {draft.plan}</div>}
          </div>
        )}
      </Card>

      {/* Clinical Summary */}
      <Card className="mb-5">
        <h2 className="font-semibold mb-1">Clinical Summary</h2>
        <p className="text-xs text-ink-500 mb-3">Summarizes a patient's recorded visit history.</p>
        <div className="flex gap-2">
          <select className="input flex-1" value={summaryPatientId} onChange={(e) => setSummaryPatientId(e.target.value)}>
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
            className="btn-primary whitespace-nowrap"
          >
            {summaryMutation.isPending ? "Summarizing..." : "Summarize"}
          </button>
        </div>

        {summaryMutation.data && (
          <div className="mt-4 pt-4 border-t border-ink-100 text-sm bg-ink-50 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium mb-2">{summaryMutation.data.disclaimer}</p>
            <p>{summaryMutation.data.summary}</p>
            <p className="text-xs text-ink-400 mt-2">
              Based on {summaryMutation.data.basedOnEncounters} recorded encounter(s).
            </p>
          </div>
        )}
      </Card>

      {/* Copilot */}
      <Card className="mb-5">
        <h2 className="font-semibold mb-1">HealthOS Copilot</h2>
        <p className="text-xs text-ink-500 mb-3">
          Ask about this hospital's current operational data (patients, appointments, stock, beds, billing).
        </p>
        <div className="flex gap-2">
          <input
            placeholder="e.g. How many beds are available right now?"
            className="input flex-1"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            onClick={() => copilotMutation.mutate()}
            disabled={copilotMutation.isPending || !question}
            className="btn-primary"
          >
            {copilotMutation.isPending ? "Asking..." : "Ask"}
          </button>
        </div>
        {copilotMutation.data && (
          <div className="mt-4 pt-4 border-t border-ink-100 text-sm bg-ink-50 rounded-xl p-3">
            <p>{copilotMutation.data.answer}</p>
          </div>
        )}
      </Card>

      {/* Voice Assistant */}
      <Card className="mb-5">
        <h2 className="font-semibold mb-1">Voice Assistant</h2>
        <p className="text-xs text-ink-500 mb-3">
          Speak a question — it's transcribed (Whisper) and answered by the same read-only Copilot above.
          Never books or changes anything on its own (spec §32).
        </p>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={isRecording ? "btn-primary bg-rose-600 hover:bg-rose-700" : "btn-primary"}
        >
          {isRecording ? "⏹ Stop recording" : "🎙 Start recording"}
        </button>
        {voiceMutation.isPending && <p className="text-xs text-ink-400 mt-2">Transcribing…</p>}
        {voiceMutation.isError && <p className="text-xs text-rose-600 mt-2">Couldn't transcribe — check the AI service is up.</p>}
        {voiceMutation.data && (
          <div className="mt-4 pt-4 border-t border-ink-100 text-sm bg-ink-50 rounded-xl p-3 space-y-1">
            <p className="text-xs text-ink-400">You said: "{voiceMutation.data.transcript}"</p>
            <p>{voiceMutation.data.answer}</p>
          </div>
        )}
      </Card>

      {/* Multi-Agent Orchestrator */}
      <Card>
        <h2 className="font-semibold mb-1">Multi-Agent Orchestrator</h2>
        <p className="text-xs text-ink-500 mb-3">
          Routes your question to one or more specialist agents (Operations, Finance, Inventory) and combines
          their read-only reports. No agent can create, update, or delete anything (spec §34).
        </p>
        <div className="flex gap-2">
          <input
            placeholder="e.g. How are we doing on beds and revenue this month?"
            className="input flex-1"
            value={orchestratorQuestion}
            onChange={(e) => setOrchestratorQuestion(e.target.value)}
          />
          <button
            onClick={() => orchestratorMutation.mutate()}
            disabled={orchestratorMutation.isPending || !orchestratorQuestion}
            className="btn-primary whitespace-nowrap"
          >
            {orchestratorMutation.isPending ? "Running agents..." : "Run agents"}
          </button>
        </div>

        {orchestratorMutation.data && (
          <div className="mt-4 pt-4 border-t border-ink-100 text-sm space-y-3">
            <p className="text-xs text-amber-700 font-medium">{orchestratorMutation.data.disclaimer}</p>
            <div className="flex gap-1.5 flex-wrap">
              {orchestratorMutation.data.agentsInvoked.map((a) => (
                <span key={a} className="badge-brand capitalize">{a} agent</span>
              ))}
            </div>
            {orchestratorMutation.data.results.map((r) => (
              <div key={r.agent} className="bg-ink-50 rounded-xl p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mb-1 capitalize">{r.agent}</p>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(r.data, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}