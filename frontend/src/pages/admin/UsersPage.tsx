import { useState, useEffect } from "react";
import { api } from "@/api/client";

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  HOSPITAL_ADMIN: "bg-purple-100 text-purple-800",
  DOCTOR: "bg-blue-100 text-blue-800",
  NURSE: "bg-green-100 text-green-800",
  RECEPTIONIST: "bg-yellow-100 text-yellow-800",
  PHARMACIST: "bg-orange-100 text-orange-800",
  LAB_TECHNICIAN: "bg-teal-100 text-teal-800",
  ACCOUNTANT: "bg-gray-100 text-gray-800",
  PATIENT: "bg-pink-100 text-pink-800",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-red-100 text-red-800",
  LOCKED: "bg-orange-100 text-orange-800",
  PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    temporaryPassword: "",
    role: "DOCTOR" as string,
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("invite");
    setError("");

    try {
      await api.post("/users", inviteForm);
      setShowInviteModal(false);
      setInviteForm({ email: "", firstName: "", lastName: "", temporaryPassword: "", role: "DOCTOR" });
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to invite user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (user: UserRecord) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg =
      newStatus === "INACTIVE"
        ? `Deactivate ${user.firstName} ${user.lastName}? Their active sessions will be revoked immediately.`
        : `Reactivate ${user.firstName} ${user.lastName}?`;

    if (!confirm(confirmMsg)) return;

    setActionLoading(user.id);
    setError("");

    try {
      await api.patch(`/users/${user.id}/status`, { status: newStatus });
      await fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update user status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (user: UserRecord) => {
    const newPassword = prompt(
      `Enter new temporary password for ${user.firstName} ${user.lastName} (min 8 chars):`
    );
    if (!newPassword || newPassword.length < 8) {
      if (newPassword !== null) alert("Password must be at least 8 characters");
      return;
    }

    setActionLoading(user.id);
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword });
      alert("Password reset successful. Communicate the new password securely.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to reset password");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage hospital staff accounts, roles, and access.
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
        >
          + Invite User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4">
          {error}
          <button onClick={() => setError("")} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          className="w-full md:w-96 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">MFA</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <span className="font-medium text-sm">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      ROLE_COLORS[user.role] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.role.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      STATUS_COLORS[user.status] || "bg-gray-100"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {user.mfaEnabled ? (
                    <span className="text-green-600 font-medium">Enabled</span>
                  ) : (
                    <span className="text-gray-400">Off</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      disabled={actionLoading === user.id}
                      className={`text-xs px-3 py-1.5 rounded font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-green-50 text-green-600 hover:bg-green-100"
                      } disabled:opacity-50`}
                    >
                      {actionLoading === user.id
                        ? "..."
                        : user.status === "ACTIVE"
                        ? "Deactivate"
                        : "Reactivate"}
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      disabled={actionLoading === user.id}
                      className="text-xs px-3 py-1.5 rounded font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Invite New User</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={inviteForm.temporaryPassword}
                  onChange={(e) => setInviteForm({ ...inviteForm, temporaryPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                >
                  <option value="HOSPITAL_ADMIN">Hospital Admin</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="NURSE">Nurse</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="LAB_TECHNICIAN">Lab Technician</option>
                  <option value="ACCOUNTANT">Accountant</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === "invite"}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === "invite" ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
