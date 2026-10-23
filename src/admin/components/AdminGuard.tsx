import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  validateSession,
  getUserProfile,
  logout,
  mustChangePassword,
} from "../../services/middleware.service";
import { useTenant } from "../../context/TenantContext";
import {
  NoBranchAccessScreen,
  TenantErrorScreen,
} from "../../components/TenantStatusScreens";

type AuthState = "checking" | "authenticated" | "must-change-password" | "unauthenticated";

function Verifying() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Verifying session...</p>
    </div>
  );
}

export function AdminGuard() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const tenant = useTenant();
  const navigate = useNavigate();
  const hasBeenReady = useRef(false);

  useEffect(() => {
    async function verify() {
      try {
        const user = await validateSession();
        if (!user) {
          setAuthState("unauthenticated");
          return;
        }

        const profile = await getUserProfile(user.id);

        if (profile.role !== "ADMIN") {
          await logout();
          setAuthState("unauthenticated");
          return;
        }

        // A first-time admin still on the temporary password must choose their own.
        setAuthState(mustChangePassword(user) ? "must-change-password" : "authenticated");
      } catch {
        setAuthState("unauthenticated");
      }
    }

    verify();
  }, []);

  if (tenant.status === "ready") hasBeenReady.current = true;

  // Safety net: a valid session whose tenant state never loaded.
  useEffect(() => {
    if (authState === "authenticated" && tenant.status === "signed-out" && !hasBeenReady.current) {
      void tenant.reload();
    }
  }, [authState, tenant.status]);

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  if (authState === "checking") return <Verifying />;

  if (authState === "unauthenticated") {
    return <Navigate to="/admin/login" replace />;
  }

  if (authState === "must-change-password") {
    return <Navigate to="/admin/change-password" replace />;
  }

  if (tenant.status === "no-access") {
    return (
      <NoBranchAccessScreen
        organizationName={tenant.organizationName}
        onSignOut={signOut}
      />
    );
  }

  if (tenant.status === "error") {
    return <TenantErrorScreen onRetry={() => void tenant.reload()} onSignOut={signOut} />;
  }

  // Once the app has been shown, keep it on screen if the session ends: the
  // screens show their own "logged out" / "session expired" popups, which
  // would be lost if the page were swapped for a spinner.
  if (tenant.status !== "ready" && !hasBeenReady.current) return <Verifying />;

  // Remounting on a branch change makes every screen refetch for the new branch.
  return <Outlet key={tenant.epoch} />;
}
