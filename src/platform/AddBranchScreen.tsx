import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addBranchToOrganization,
  getOrganizationBranches,
  getPlatformOrganizations,
} from "../services/middleware.service";
import type { PlatformBranch, PlatformOrganization } from "../services/types";
import { formatDate, todayPlus } from "./dates";

const inputClass =
  "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none";

/** Adds one more branch to an existing client. Reached from the "Add branch" button in the list. */
export function AddBranchScreen() {
  const navigate = useNavigate();
  const { organizationId } = useParams<{ organizationId: string }>();

  const [org, setOrg] = useState<PlatformOrganization | null>(null);
  const [branches, setBranches] = useState<PlatformBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [renewalDate, setRenewalDate] = useState(todayPlus(30));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ name: string; code: string; adminsGranted: number } | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    Promise.all([getPlatformOrganizations(), getOrganizationBranches(organizationId)])
      .then(([orgs, bs]) => {
        const found = orgs.find((o) => o.id === organizationId) ?? null;
        if (!found) setLoadError("Organization not found.");
        setOrg(found);
        setBranches(bs);
      })
      .catch(() => setLoadError("Could not load the organization. Please go back and try again."))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const canSubmit = name.trim() !== "" && code.trim() !== "" && renewalDate !== "";

  const handleSubmit = async () => {
    if (!organizationId || submitting || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await addBranchToOrganization({ organizationId, name, code, renewalDate });
      setCreated({ name: name.trim(), code: code.trim().toUpperCase(), adminsGranted: result.adminsGranted });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (loadError || !org) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 p-4">
        <p className="text-red-700">{loadError || "Organization not found."}</p>
        <button onClick={() => navigate("/platform")} className="text-slate-700 underline">
          Back to organizations
        </button>
      </div>
    );
  }

  /* ---- after success ---- */
  if (created) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-gray-900 mb-2">Branch added</h1>
          <p className="text-gray-600 mb-4">
            <strong>{created.name}</strong> ({created.code}) now belongs to <strong>{org.name}</strong>, with its own
            cash account, settings and materials.
          </p>
          {created.adminsGranted > 0 ? (
            <p className="text-gray-600 mb-6">
              {created.adminsGranted === 1 ? "Their admin" : `Their ${created.adminsGranted} admins`} can switch to it
              from the branch switcher after refreshing the page.
            </p>
          ) : (
            <p className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg mb-6">
              This organization has no admin yet, so nobody can use the new branch until one is given access.
            </p>
          )}
          <button
            onClick={() => navigate("/platform", { replace: true })}
            className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
          >
            Back to organizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate("/platform")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 my-4"
        >
          <ArrowLeft className="w-5 h-5" /> Back to organizations
        </button>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-gray-900 mb-1">Add branch</h1>
          <p className="text-gray-600 mb-6">
            to <strong>{org.name}</strong>
          </p>

          <div className="mb-6">
            <div className="text-sm text-gray-500 mb-2">Existing branches</div>
            <ul className="text-gray-800 text-sm space-y-1">
              {branches.map((b) => (
                <li key={b.id}>
                  {b.name} <span className="text-gray-500">({b.code})</span>
                  {b.renewalDate && <span className="text-gray-500"> · renews {formatDate(b.renewalDate)}</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-gray-700 mb-2">Branch name *</label>
              <input className={inputClass} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Branch code *</label>
              <input className={inputClass} value={code} onChange={(e) => { setCode(e.target.value); setError(""); }} />
              <p className="text-sm text-gray-500 mt-1">Short and unique within this organization, for example NORTH.</p>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">First renewal date *</label>
              <input type="date" min={todayPlus(0)} className={inputClass} value={renewalDate} onChange={(e) => { setRenewalDate(e.target.value); setError(""); }} />
              <p className="text-sm text-gray-500 mt-1">When this branch's first payment is due.</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full bg-slate-800 text-white py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              {submitting ? "Adding..." : "Add branch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
