import React, { useState } from "react";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { provisionOrganization } from "../services/middleware.service";
import type { ProvisionOrganizationResult } from "../services/types";

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const inputClass =
  "w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable: the value is on screen to copy by hand */
        }
      }}
      className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CreateOrganizationScreen() {
  const navigate = useNavigate();

  const [organizationName, setOrganizationName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [branchName, setBranchName] = useState("Main");
  const [branchCode, setBranchCode] = useState("MAIN");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [trialDays, setTrialDays] = useState("14");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProvisionOrganizationResult | null>(null);

  const canSubmit =
    organizationName.trim() && slug && branchName.trim() && branchCode.trim() && adminEmail.trim() && adminPhone.trim();

  const handleSubmit = async () => {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const created = await provisionOrganization({
        organizationName,
        slug,
        branchName,
        branchCode,
        adminEmail,
        adminPhone,
        contactEmail: contactEmail || undefined,
        trialDays: Number(trialDays),
      });
      setResult(created);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- shown once, after success ---- */
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-gray-900 mb-2">Organization created</h1>
          <p className="text-gray-600 mb-6">
            Give these sign-in details to the client's admin. The password is shown only once and cannot be
            retrieved later.
          </p>

          <div className="space-y-4 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <CopyButton value={result.adminEmail} />
              </div>
              <div className="text-gray-900 break-all">{result.adminEmail}</div>
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Temporary password</span>
                <CopyButton value={result.temporaryPassword} />
              </div>
              <div className="text-gray-900 font-mono break-all">{result.temporaryPassword}</div>
            </div>
          </div>

          <button
            onClick={() => {
              setResult(null);
              navigate("/platform", { replace: true });
            }}
            className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700"
          >
            I have saved these details
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
          <h1 className="text-gray-900 mb-6">New organization</h1>

          <div className="space-y-5">
            <div>
              <label className="block text-gray-700 mb-2">Organization name *</label>
              <input
                className={inputClass}
                value={organizationName}
                onChange={(e) => {
                  setOrganizationName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                  setError("");
                }}
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Slug *</label>
              <input
                className={inputClass}
                value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugEdited(true); setError(""); }}
              />
              <p className="text-sm text-gray-500 mt-1">Lowercase letters, numbers and hyphens. Must be unique.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">First branch name *</label>
                <input className={inputClass} value={branchName} onChange={(e) => { setBranchName(e.target.value); setError(""); }} />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Branch code *</label>
                <input className={inputClass} value={branchCode} onChange={(e) => { setBranchCode(e.target.value); setError(""); }} />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Admin email (their login) *</label>
              <input type="email" className={inputClass} value={adminEmail} onChange={(e) => { setAdminEmail(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Admin phone *</label>
              <input className={inputClass} value={adminPhone} onChange={(e) => { setAdminPhone(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Contact email (optional)</label>
              <input type="email" className={inputClass} value={contactEmail} onChange={(e) => { setContactEmail(e.target.value); setError(""); }} />
            </div>
            <div>
              <label className="block text-gray-700 mb-2">Trial length (days)</label>
              <input type="number" min={1} max={365} className={inputClass} value={trialDays} onChange={(e) => { setTrialDays(e.target.value); setError(""); }} />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full bg-slate-800 text-white py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              {submitting ? "Creating..." : "Create organization"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
