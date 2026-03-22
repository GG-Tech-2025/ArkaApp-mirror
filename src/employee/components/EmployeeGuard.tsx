import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import {
  validateSession,
  getUserProfile,
  logout,
  checkEmployeeIsActive,
} from "../../services/middleware.service";

type AuthState = "checking" | "authenticated" | "unauthenticated" | "blocked";

export function EmployeeGuard() {
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    async function verify() {
      try {
        const user = await validateSession();
        if (!user) {
          setAuthState("unauthenticated");
          return;
        }

        const profile = await getUserProfile(user.id);

        if (profile.role !== "EMPLOYEE") {
          await logout();
          setAuthState("unauthenticated");
          return;
        }

        const isActive = await checkEmployeeIsActive(profile.phone);
        if (!isActive) {
          await logout();
          setAuthState("blocked");
          return;
        }

        setAuthState("authenticated");
      } catch {
        setAuthState("unauthenticated");
      }
    }

    verify();
  }, []);

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Verifying session...</p>
      </div>
    );
  }

  if (authState === "blocked") {
    return <Navigate to="/employee/login" replace state={{ blocked: true }} />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/employee/login" replace />;
  }

  return <Outlet />;
}
