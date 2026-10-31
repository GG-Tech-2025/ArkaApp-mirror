import React, { useState } from "react";
import { Building2 } from "lucide-react";
import { useTenant } from "../../context/TenantContext";

/**
 * Shows which organization and branch the admin is working in. With more than
 * one branch it becomes a dropdown; choosing one saves it, refreshes the
 * session, and reloads the screens for that branch.
 */
export function BranchSwitcher() {
  const { organizationName, branches, activeBranch, switchBranch } = useTenant();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  if (!activeBranch) return null;

  if (branches.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Building2 className="w-4 h-4" />
        <span>
          {organizationName ? `${organizationName} · ` : ""}
          {activeBranch.name}
        </span>
      </div>
    );
  }

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSwitching(true);
    setError("");
    try {
      await switchBranch(e.target.value);
    } catch {
      setError("Couldn't switch branch. Please try again.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <Building2 className="w-4 h-4" />
        {organizationName && <span className="hidden sm:inline">{organizationName} ·</span>}
        <select
          value={activeBranch.id}
          onChange={onChange}
          disabled={switching}
          aria-label="Active branch"
          className="border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 disabled:opacity-60"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id} disabled={branch.status !== "ACTIVE"}>
              {branch.name}
              {branch.status !== "ACTIVE" ? " (paused)" : ""}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
