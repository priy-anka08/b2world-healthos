import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
}
interface ExtractResult {
  patientDocumentId: string;
  documentType: string;
  rawText: string;
  extractedFields: Record<string, unknown>;
  confidence: number;
  disclaimer: string;
}
interface PendingDoc {
  id: string;
  type: string;
  ocrStatus: string;
  createdAt: string;
  patient: { firstName: string; lastName: string; patientCode: string };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DocumentOCRPage() {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [documentType, setDocumentType] = useState("prescription");
  const [imageBase64, setImageBase64] = useState("");
  const [fileName, setFileName] = useState("");

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const { data: pending } = useQuery<PendingDoc[]>({
    queryKey: ["ai-ocr-pending"],
    queryFn: () => api.get("/ai/ocr/pending").then((r) => r.data),
  });

  const extractMutation = useMutation({
    mutationFn: () =>
      api.post("/ai/ocr/extract", { patientId, documentType, imageBase64 }).then((r) => r.data as ExtractResult),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-ocr-pending"] }),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.post(`/ai/ocr/${id}/verify`, {}).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-ocr-pending"] }),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImageBase64(await fileToBase64(file));
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Document OCR</h1>
      <p className="text-slate-500 text-sm mb-6">
        Upload a prescription, lab report, discharge summary, or referral. PaddleOCR extracts a structured draft —
        it never saves to the patient record until a human verifies it below.
      </p>

      <div className="bg-white border rounded-xl p-6 mb-6">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            <option value="">Select patient…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName} ({p.patientCode})
              </option>
            ))}
          </select>
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
          >
            <option value="prescription">Prescription</option>
            <option value="lab_report">Lab report</option>
            <option value="discharge_summary">Discharge summary</option>
            <option value="referral">Referral</option>
          </select>
        </div>
        <input type="file" accept="image/*" onChange={handleFile} className="text-sm mb-3" />
        {fileName && <p className="text-xs text-slate-400 mb-3">Selected: {fileName}</p>}
        <button
          onClick={() => extractMutation.mutate()}
          disabled={extractMutation.isPending || !patientId || !imageBase64}
          className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {extractMutation.isPending ? "Extracting..." : "Extract"}
        </button>

        {extractMutation.isError && (
          <p className="text-xs text-red-600 mt-2">
            Couldn't extract — check the AI service is up and PaddleOCR has finished loading.
          </p>
        )}

        {extractMutation.data && (
          <div className="mt-4 pt-4 border-t text-sm space-y-2 bg-slate-50 rounded p-3">
            <p className="text-xs text-amber-700 font-medium">{extractMutation.data.disclaimer}</p>
            <div>
              <b>Type:</b> {extractMutation.data.documentType} · <b>Confidence:</b>{" "}
              {(extractMutation.data.confidence * 100).toFixed(0)}%
            </div>
            <div>
              <b>Extracted fields:</b>
              <pre className="text-xs bg-white border rounded p-2 mt-1 overflow-x-auto">
                {JSON.stringify(extractMutation.data.extractedFields, null, 2)}
              </pre>
            </div>
            <button
              onClick={() => verifyMutation.mutate(extractMutation.data!.patientDocumentId)}
              disabled={verifyMutation.isPending}
              className="bg-green-700 text-white rounded-lg px-4 py-2 text-xs font-medium disabled:opacity-50"
            >
              {verifyMutation.isPending ? "Saving..." : "Verify & save to record"}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h2 className="font-semibold mb-3">Pending verification</h2>
        {pending?.length === 0 && <p className="text-sm text-slate-400">Nothing waiting on review.</p>}
        <ul className="text-sm divide-y">
          {pending?.map((d) => (
            <li key={d.id} className="py-2 flex items-center justify-between">
              <span>
                {d.type.replace("_", " ")} — {d.patient.firstName} {d.patient.lastName} ({d.patient.patientCode})
              </span>
              <button
                onClick={() => verifyMutation.mutate(d.id)}
                disabled={verifyMutation.isPending}
                className="text-xs text-green-700 underline"
              >
                Verify
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}