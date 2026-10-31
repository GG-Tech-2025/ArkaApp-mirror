import React, { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  validateSession,
  getUserProfile,
  logout,
  checkEmployeeIsActive,
} from "../../services/middleware.service";
import { useTenant } from "../../context/TenantContext";
import {
  BranchPausedScreen,
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

/** Screens that tell the employee themselves when their session ends, so the guard waits for them. */
const SCREENS_THAT_EXPLAIN_SESSION_END = ["/employee/home"];

export function EmployeeGuard() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const tenant = useTenant();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const hasBeenReady = useRef(false);
  const explainsSessionEnd = SCREENS_THAT_EXPLAIN_SESSION_END.includes(pathname);
  const onExplainingScreen = useRef(explainsSessionEnd);
  onExplainingScreen.current = explainsSessionEnd;

  // If the session ended while on an explaining screen and the employee then moves to any
  // other screen, there is nothing left to wait for: send them to login.
  useEffect(() => {
    if (authState === "authenticated" && tenant.status === "signed-out" && !explainsSessionEnd) {
      setAuthState("unauthenticated");
    }
  }, [authState, tenant.status, explainsSessionEnd]);

  useEffect(() => {
    // Wait for the branch to be known: the "is this employee active" lookup
    // below is scoped to the active branch, so asking too early would wrongly
    // report an active employee as deactivated.
    if (tenant.status === "loading") return;

    let cancelled = false;
    const update = (
      next: AuthState,
      options: { keepIfAuthenticatedOnExplainingScreen?: boolean } = {},
    ) => {
      if (cancelled) return;
      setAuthState((current) =>
        options.keepIfAuthenticatedOnExplainingScreen &&
        current === "authenticated" &&
        onExplainingScreen.current
          ? current
          : next,
      );
    };

    async function verify() {
      try {
        const user = await validateSession();
        if (!user) {
          // A session that ends while the employee is on a screen that explains it (the
          // Home screen shows "Logout Successful" or "Session Expired") must not be
          // redirected away yet, or that popup would never be seen.
          update("unauthenticated", { keepIfAuthenticatedOnExplainingScreen: true });
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

  if (tenant.status === "paused") {
    return (
      <BranchPausedScreen
        organizationName={tenant.organizationName}
        organizationPaused={tenant.organizationStatus !== "ACTIVE"}
        branchName={tenant.activeBranch?.name}
        onRetry={() => void tenant.reload()}
        onSignOut={signOut}
      />
    );
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
