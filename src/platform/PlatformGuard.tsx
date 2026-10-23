import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { validateSession, getUserProfile } from "../services/middleware.service";

type GuardState = "checking" | "allowed" | "denied";

/**
 * Lets only a platform super-admin (flagged, and belonging to no organization)
 * through. This only decides what to show: the database and the Edge Function
 * make the same check, so skipping this screen gains nothing.
 */
export function PlatformGuard() {
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    async function verify() {
      try {
        const user = await validateSession();
        if (!user) return setState("denied");
        const profile = await getUserProfile(user.id);
        setState(profile.is_super_admin && !profile.organization_id ? "allowed" : "denied");
      } catch {
        setState("denied");
      }
    }
    verify();
  }, []);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Verifying session...</p>
      </div>
    );
  }
  if (state === "denied") return <Navigate to="/platform/login" replace />;
  return <Outlet />;
}
