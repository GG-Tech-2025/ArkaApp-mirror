import React from "react";
import { Building2, AlertTriangle, LogOut } from "lucide-react";

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
