import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  validateSession,
  getUserProfile,
  logout,
  checkEmployeeIsActive,
} from "../../services/middleware.service";
import { useTenant } from "../../context/TenantContext";
import {
  NoBranchAccessScreen,
  TenantErrorScreen,
} from "../../components/TenantStatusScreens";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "blocked";

function Verifying() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Verifying session...</p>
    </div>
  );
}

export function EmployeeGuard() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const tenant = useTenant();
  const navigate = useNavigate();
  const hasBeenReady = useRef(false);

  useEffect(() => {
    // Wait for the branch to be known: the "is this employee active" lookup
    // below is scoped to the active branch, so asking too early would wrongly
    // report an active employee as deactivated.
    if (tenant.status === "loading") return;

    let cancelled = false;
    const update = (next: AuthState) => {
      if (!cancelled) setAuthState(next);
    };

    async function verify() {
      try {
        const user = await validateSession();
        if (!user) {
          update("unauthenticated");
          return;
        }

        const profile = await getUserProfile(user.id);

        if (profile.role !== "EMPLOYEE") {
          await logout();
          update("unauthenticated");
          return;
        }

        if (tenant.status === "ready") {
          const isActive = await checkEmployeeIsActive();
          if (!isActive) {
            await logout();
            update("blocked");
            return;
          }
        }

        update("authenticated");
      } catch {
        update("unauthenticated");
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [tenant.status, tenant.activeBranchId]);

  if (tenant.status === "ready") hasBeenReady.current = true;

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/employee/login", { replace: true });
    }
  };

  if (authState === "checking") return <Verifying />;

  if (authState === "blocked") {
    return <Navigate to="/employee/login" replace state={{ blocked: true }} />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/employee/login" replace />;
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

  if (tenant.status !== "ready" && !hasBeenReady.current) return <Verifying />;

  // Remounting on a branch change makes every screen refetch for the new branch.
  return <Outlet key={tenant.epoch} />;
}
