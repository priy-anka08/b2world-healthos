import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface DocumentItem {
  id: string;
  title: string;
  category: string;
  createdAt: string;
}

const emptyForm = { title: "", category: "sop", content: "" };

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: documents, isLoading } = useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: () => api.get("/documents").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) => api.post("/documents", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setForm(emptyForm);
      setShowForm(false);
    },
  });

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-slate-500 text-sm">
            {documents?.length ?? 0} SOPs / policies. Text-based for now — a future RAG assistant will read these.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          {showForm ? "Cancel" : "+ Add document"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(form);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3"
        >
          <input required placeholder="Title" className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="sop">SOP</option>
            <option value="policy">Policy</option>
            <option value="guideline">Guideline</option>
            <option value="equipment_manual">Equipment manual</option>
            <option value="department_doc">Department doc</option>
          </select>
          <textarea required placeholder="Paste the document text here" rows={6} className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <button type="submit" disabled={createMutation.isPending} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
            {createMutation.isPending ? "Saving..." : "Save document"}
          </button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={3}>Loading...</td></tr>}
            {documents?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={3}>No documents yet.</td></tr>}
            {documents?.map((d) => (
              <tr key={d.id} className="border-t">
                <td className="px-4 py-2">{d.title}</td>
                <td className="px-4 py-2 capitalize">{d.category.replace("_", " ")}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(d.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}