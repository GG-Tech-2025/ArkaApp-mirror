import React, { useEffect, useState } from "react";
import { Building2, LogOut, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlatformOrganizations, logout } from "../services/middleware.service";
import type { PlatformOrganization } from "../services/types";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function PlatformHomeScreen() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPlatformOrganizations()
      .then(setOrgs)
      .catch(() => setError("Could not load organizations. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/platform/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6" />
            <h1 className="text-lg">Platform</h1>
          </div>
          <button onClick={signOut} className="flex items-center gap-2 text-slate-200 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-gray-900">Organizations</h2>
          <button
            onClick={() => navigate("/platform/organizations/new")}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700"
          >
            <Plus className="w-4 h-4" /> New organization
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : orgs.length === 0 && !error ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
            No organizations yet. Create the first one.
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-100 text-gray-600 text-sm">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Branches</th>
                  <th className="px-4 py-3">Admin phone</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{o.name}</div>
                      <div className="text-sm text-gray-500">{o.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{o.plan}</div>
                      {o.plan === "trial" && o.trialEndsAt && (
                        <div className="text-sm text-gray-500">ends {formatDate(o.trialEndsAt)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{o.status}</td>
                    <td className="px-4 py-3">{o.branchCount}</td>
                    <td className="px-4 py-3">{o.adminPhones.join(", ") || "—"}</td>
                    <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
