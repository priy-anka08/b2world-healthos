import { useState } from "react";
import { api } from "@/api/client";

interface SuggestedStaff {
  staffId: string;
  userId: string;
  name: string;
  department: string;
  jobTitle: string | null;
}

interface ShiftSuggestion {
  shift: string;
  startHour: number;
  endHour: number;
  suggestedStaff: SuggestedStaff[];
  suggestedCount: number;
  assignedCount: number;
  understaffed: boolean;
}

interface ScheduleSuggestion {
  date: string;
  forecastedPatientVolume: number;
  historicalDataWeeks: number;
  totalAvailableStaff: number;
  totalAlreadyScheduled: number;
  shifts: ShiftSuggestion[];
  note: string;
}

export default function StaffSchedulingPage() {
  const [date, setDate] = useState("");
  const [suggestion, setSuggestion] = useState<ScheduleSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleGenerate = async () => {
    if (!date) return;
    setLoading(true);
    setError("");
    setSuggestion(null);
    setSuccess("");

    try {
      const res = await api.post("/staff/schedule/suggest", { date });
      setSuggestion(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!suggestion) return;
    setApplying(true);
    setError("");

    const shifts = suggestion.shifts.flatMap((s) =>
      s.suggestedStaff.map((staff) => ({
        staffId: staff.staffId,
        startHour: s.startHour,
        endHour: s.endHour,
      }))
    );

    try {
      const res = await api.post("/staff/schedule/apply", { date, shifts });
      setSuccess(`Schedule applied! ${res.data.shiftsCreated} shifts created.`);
      setSuggestion(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to apply schedule");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">AI Staff Scheduling</h1>
      <p className="text-gray-500 mb-6">
        Generate AI-recommended staff schedules based on historical patient volume and staff availability.
      </p>

      {/* Date selection */}
      <div className="flex gap-3 mb-6">
        <input
          type="date"
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !date}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? "Analyzing..." : "Generate Suggestion"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 mb-6">{success}</div>
      )}

      {suggestion && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{suggestion.forecastedPatientVolume}</div>
              <div className="text-xs text-gray-500 mt-1">Forecasted Daily Volume</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{suggestion.totalAvailableStaff}</div>
              <div className="text-xs text-gray-500 mt-1">Available Staff</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{suggestion.totalAlreadyScheduled}</div>
              <div className="text-xs text-gray-500 mt-1">Already Scheduled</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{suggestion.historicalDataWeeks}w</div>
              <div className="text-xs text-gray-500 mt-1">Historical Data</div>
            </div>
          </div>

          {/* Shift suggestions */}
          {suggestion.shifts.map((shift) => (
            <div key={shift.shift} className="bg-white border rounded-lg overflow-hidden">
              <div className={`px-4 py-3 flex justify-between items-center ${
                shift.understaffed ? "bg-red-50 border-b border-red-100" : "bg-gray-50 border-b"
              }`}>
                <div>
                  <span className="font-semibold">{shift.shift} Shift</span>
                  <span className="text-gray-500 text-sm ml-2">
                    ({String(shift.startHour).padStart(2, "0")}:00 – {String(shift.endHour).padStart(2, "0")}:00)
                  </span>
                </div>
                <div className="text-sm">
                  {shift.assignedCount}/{shift.suggestedCount} staff
                  {shift.understaffed && (
                    <span className="ml-2 text-red-600 font-medium">⚠ Understaffed</span>
                  )}
                </div>
              </div>
              <div className="p-4">
                {shift.suggestedStaff.length === 0 ? (
                  <p className="text-gray-400 text-sm">No available staff to assign</p>
                ) : (
                  <div className="space-y-2">
                    {shift.suggestedStaff.map((staff) => (
                      <div key={staff.staffId} className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                          {staff.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{staff.name}</div>
                          <div className="text-xs text-gray-500">
                            {staff.department} {staff.jobTitle && `• ${staff.jobTitle}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Advisory note + apply */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            {suggestion.note}
          </div>

          <button
            onClick={handleApply}
            disabled={applying}
            className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            {applying ? "Applying..." : "Approve & Apply Schedule"}
          </button>
        </div>
      )}
    </div>
  );
}
