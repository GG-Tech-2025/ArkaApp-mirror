import React from "react";
import { Building2, AlertTriangle, LogOut, PauseCircle } from "lucide-react";
import { support } from "../config/support";

interface NoBranchAccessProps {
  organizationName?: string | null;
  onSignOut: () => void;
}

/** Shown when someone signs in fine but has not been assigned to any branch. */
export function NoBranchAccessScreen({ organizationName, onSignOut }: NoBranchAccessProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="inline-flex bg-amber-100 p-4 rounded-full mb-4">
          <Building2 className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-gray-900 mb-2">No branch access</h1>
        <p className="text-gray-600 mb-6">
          {organizationName ? `Your account at ${organizationName} ` : "Your account "}
          hasn't been assigned to a branch yet. Please contact your administrator.
        </p>
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </div>
    </div>
  );
}

interface TenantErrorProps {
  onRetry: () => void;
  onSignOut: () => void;
}

/** Shown when the branch information could not be loaded. */
export function TenantErrorScreen({ onRetry, onSignOut }: TenantErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="inline-flex bg-red-100 p-4 rounded-full mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-gray-900 mb-2">Couldn't load your branch</h1>
        <p className="text-gray-600 mb-6">
          Something went wrong while loading your branch details. Please try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

interface BranchPausedProps {
  organizationName?: string | null;
  /** True when the whole organization is paused, not just one branch. */
  organizationPaused: boolean;
  /** The branch that was being used, when known. */
  branchName?: string | null;
  onRetry: () => void;
  onSignOut: () => void;
}

/**
 * Shown when everything the user can reach has been paused by the platform
 * operator (usually a payment is due). Nothing in the app works until it is
 * resumed, which the app notices by itself within a minute, or straight away
 * with "Check again".
 */
export function BranchPausedScreen({
  organizationName,
  organizationPaused,
  branchName,
  onRetry,
  onSignOut,
}: BranchPausedProps) {
  const where = organizationPaused
    ? organizationName ?? "Your organization"
    : [branchName, organizationName].filter(Boolean).join(" · ") || "Your branch";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="inline-flex bg-amber-100 p-4 rounded-full mb-4">
          <PauseCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-gray-900 mb-2">
          {organizationPaused ? "Your account is paused" : "This branch is paused"}
        </h1>
        <p className="text-gray-600 mb-2">{where}</p>
        <p className="text-gray-600 mb-6">
          Access has been paused, usually because a payment is due. Your data is safe. Please contact us to
          resume.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-sm text-gray-700 space-y-1">
          {support.phone || support.email ? (
            <>
              {support.phone && (
                <div>
                  Phone:{" "}
                  <a className="text-blue-700" href={`tel:${support.phone.replace(/\s+/g, "")}`}>
                    {support.phone}
                  </a>
                </div>
              )}
              {support.email && (
                <div>
                  Email:{" "}
                  <a className="text-blue-700" href={`mailto:${support.email}`}>
                    {support.email}
                  </a>
                </div>
              )}
            </>
          ) : (
            <div>Please contact GG-Tech support.</div>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Check again
          </button>
          <button
            onClick={onSignOut}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
