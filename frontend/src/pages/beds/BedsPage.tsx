import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";

interface Bed {
  id: string;
  code: string;
  status: string;
}
interface Room {
  id: string;
  number: string;
  beds: Bed[];
}
interface Ward {
  id: string;
  name: string;
  rooms: Room[];
}

const statusColor: Record<string, string> = {
  available: "bg-green-100 text-green-800",
  occupied: "bg-red-100 text-red-800",
  maintenance: "bg-amber-100 text-amber-800",
  reserved: "bg-blue-100 text-blue-800",
};

export default function BedsPage() {
  const queryClient = useQueryClient();
  const [newWardName, setNewWardName] = useState("");
  const [roomInputs, setRoomInputs] = useState<Record<string, string>>({});
  const [bedInputs, setBedInputs] = useState<Record<string, string>>({});

  const { data: wards, isLoading } = useQuery<Ward[]>({
    queryKey: ["wards"],
    queryFn: () => api.get("/beds/wards").then((r) => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ["bed-summary"],
    queryFn: () => api.get("/beds/summary").then((r) => r.data),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["wards"] });
    queryClient.invalidateQueries({ queryKey: ["bed-summary"] });
  };

  const createWard = useMutation({
    mutationFn: (name: string) => api.post("/beds/wards", { name }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setNewWardName("");
    },
  });

  const createRoom = useMutation({
    mutationFn: ({ wardId, number }: { wardId: string; number: string }) =>
      api.post(`/beds/wards/${wardId}/rooms`, { number }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const createBed = useMutation({
    mutationFn: ({ roomId, code }: { roomId: string; code: string }) =>
      api.post(`/beds/rooms/${roomId}/beds`, { code }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const setBedStatus = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api.post(`/beds/beds/${bedId}/status`, { status }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Beds &amp; Wards</h1>
          {summary && (
            <p className="text-slate-500 text-sm">
              {summary.available} available · {summary.occupied} occupied · {summary.total} total
            </p>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newWardName.trim()) createWard.mutate(newWardName.trim());
        }}
        className="flex gap-2 mb-6 max-w-md"
      >
        <input
          placeholder="New ward name (e.g. General Ward)"
          className="border rounded-lg px-3 py-2 flex-1 text-sm"
          value={newWardName}
          onChange={(e) => setNewWardName(e.target.value)}
        />
        <button type="submit" className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium">
          + Add ward
        </button>
      </form>

      {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
      {wards?.length === 0 && !isLoading && <p className="text-slate-400 text-sm">No wards yet — add one above.</p>}

      <div className="space-y-4">
        {wards?.map((ward) => (
          <div key={ward.id} className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">{ward.name}</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const number = roomInputs[ward.id]?.trim();
                  if (number) {
                    createRoom.mutate({ wardId: ward.id, number });
                    setRoomInputs({ ...roomInputs, [ward.id]: "" });
                  }
                }}
                className="flex gap-2"
              >
                <input
                  placeholder="Room number"
                  className="border rounded px-2 py-1 text-xs w-28"
                  value={roomInputs[ward.id] ?? ""}
                  onChange={(e) => setRoomInputs({ ...roomInputs, [ward.id]: e.target.value })}
                />
                <button type="submit" className="text-xs text-blue-600 underline">+ Add room</button>
              </form>
            </div>

            {ward.rooms.length === 0 && <p className="text-xs text-slate-400">No rooms yet.</p>}

            <div className="space-y-3">
              {ward.rooms.map((room) => (
                <div key={room.id} className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Room {room.number}</span>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const code = bedInputs[room.id]?.trim();
                        if (code) {
                          createBed.mutate({ roomId: room.id, code });
                          setBedInputs({ ...bedInputs, [room.id]: "" });
                        }
                      }}
                      className="flex gap-2"
                    >
                      <input
                        placeholder="Bed code"
                        className="border rounded px-2 py-1 text-xs w-24"
                        value={bedInputs[room.id] ?? ""}
                        onChange={(e) => setBedInputs({ ...bedInputs, [room.id]: e.target.value })}
                      />
                      <button type="submit" className="text-xs text-blue-600 underline">+ Add bed</button>
                    </form>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {room.beds.map((bed) => (
                      <div key={bed.id} className={`rounded-lg px-3 py-2 text-xs ${statusColor[bed.status] ?? "bg-slate-100"}`}>
                        <div className="font-medium mb-1">{bed.code}</div>
                        <select
                          value={bed.status}
                          onChange={(e) => setBedStatus.mutate({ bedId: bed.id, status: e.target.value })}
                          className="bg-transparent text-xs border-0 p-0 focus:ring-0"
                        >
                          <option value="available">Available</option>
                          <option value="occupied">Occupied</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="reserved">Reserved</option>
                        </select>
                      </div>
                    ))}
                    {room.beds.length === 0 && <span className="text-xs text-slate-400">No beds yet.</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}