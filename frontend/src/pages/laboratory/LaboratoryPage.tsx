import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Patient {
  id: string;
  patientCode: string;
  firstName: string;
  lastName: string;
}
interface LabTest {
  id: string;
  name: string;
  code: string;
  price: string;
}
interface LabOrder {
  id: string;
  status: string;
  patient: { firstName: string; lastName: string; patientCode: string };
  labTest: { name: string; code: string };
}

const emptyTestForm = { name: "", code: "", price: 0 };
const emptyOrderForm = { patientId: "", labTestId: "" };

export default function LaboratoryPage() {
  const queryClient = useQueryClient();
  const [showTestForm, setShowTestForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [testForm, setTestForm] = useState(emptyTestForm);
  const [orderForm, setOrderForm] = useState(emptyOrderForm);

  const { data: tests } = useQuery<LabTest[]>({
    queryKey: ["lab-tests"],
    queryFn: () => api.get("/laboratory/tests").then((r) => r.data),
  });

  const { data: orders, isLoading } = useQuery<LabOrder[]>({
    queryKey: ["lab-orders"],
    queryFn: () => api.get("/laboratory/orders").then((r) => r.data),
  });

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients"],
    queryFn: () => api.get("/patients").then((r) => r.data),
  });

  const createTest = useMutation({
    mutationFn: (payload: typeof testForm) => api.post("/laboratory/tests", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      setTestForm(emptyTestForm);
      setShowTestForm(false);
    },
  });

  const createOrder = useMutation({
    mutationFn: (payload: typeof orderForm) => api.post("/laboratory/orders", payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
      setOrderForm(emptyOrderForm);
      setShowOrderForm(false);
    },
  });

  const advanceOrder = useMutation({
    mutationFn: (id: string) => api.post(`/laboratory/orders/${id}/advance`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lab-orders"] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Laboratory</h1>
          <p className="text-slate-500 text-sm">{tests?.length ?? 0} tests catalogued · {orders?.length ?? 0} orders</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTestForm((v) => !v)} className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium">
            {showTestForm ? "Cancel" : "+ Add test type"}
          </button>
          <button onClick={() => setShowOrderForm((v) => !v)} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
            {showOrderForm ? "Cancel" : "+ Order test"}
          </button>
        </div>
      </div>

      {showTestForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTest.mutate(testForm);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg"
        >
          <div className="grid grid-cols-3 gap-3">
            <input required placeholder="Test name" className="border rounded-lg px-3 py-2 col-span-2"
              value={testForm.name} onChange={(e) => setTestForm({ ...testForm, name: e.target.value })} />
            <input required placeholder="Code" className="border rounded-lg px-3 py-2"
              value={testForm.code} onChange={(e) => setTestForm({ ...testForm, code: e.target.value })} />
            <input required type="number" min={0} placeholder="Price ₹" className="border rounded-lg px-3 py-2 col-span-3"
              value={testForm.price || ""} onChange={(e) => setTestForm({ ...testForm, price: Number(e.target.value) })} />
          </div>
          <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">Save test type</button>
        </form>
      )}

      {showOrderForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createOrder.mutate(orderForm);
          }}
          className="bg-white border rounded-xl p-6 mb-6 space-y-3 max-w-lg"
        >
          <select required className="w-full border rounded-lg px-3 py-2" value={orderForm.patientId}
            onChange={(e) => setOrderForm({ ...orderForm, patientId: e.target.value })}>
            <option value="">Select patient…</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.patientCode})</option>
            ))}
          </select>
          <select required className="w-full border rounded-lg px-3 py-2" value={orderForm.labTestId}
            onChange={(e) => setOrderForm({ ...orderForm, labTestId: e.target.value })}>
            <option value="">Select test…</option>
            {tests?.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — ₹{Number(t.price).toFixed(0)}</option>
            ))}
          </select>
          {!tests?.length && <p className="text-xs text-amber-600">Add a test type first.</p>}
          <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">Order test</button>
        </form>
      )}

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>Loading...</td></tr>}
            {orders?.length === 0 && !isLoading && <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No lab orders yet.</td></tr>}
            {orders?.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2">{o.patient.firstName} {o.patient.lastName}</td>
                <td className="px-4 py-2">{o.labTest.name}</td>
                <td className="px-4 py-2">
                  <span className="text-xs bg-slate-100 rounded-full px-2 py-1 capitalize">{o.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-2">
                  {o.status !== "reviewed" && (
                    <button onClick={() => advanceOrder.mutate(o.id)} className="text-xs text-blue-600 underline">
                      Advance status
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}