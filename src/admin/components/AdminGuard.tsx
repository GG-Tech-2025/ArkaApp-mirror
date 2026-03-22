import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import {
  validateSession,
  getUserProfile,
  logout,
} from "../../services/middleware.service";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export function AdminGuard() {
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

        if (profile.role !== "ADMIN") {
          await logout();
          setAuthState("unauthenticated");
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

  if (authState === "unauthenticated") {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
