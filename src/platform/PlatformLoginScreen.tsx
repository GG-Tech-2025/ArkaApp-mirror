import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  login,
  validateSession,
  getUserProfile,
  logout,
} from "../services/middleware.service";

const isPlatformAccount = (p: { is_super_admin: boolean; organization_id: string | null }) =>
  p.is_super_admin && !p.organization_id;

export function PlatformLoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Already signed in as a platform account: go straight in.
  useEffect(() => {
    async function checkSession() {
      const user = await validateSession();
      if (!user) return;
      try {
        const profile = await getUserProfile(user.id);
        if (isPlatformAccount(profile)) navigate("/platform", { replace: true });
      } catch {
        /* stay on the login screen */
      }
    }
    checkSession();
  }, []);

  const handleLogin = async () => {
    try {
      const session = await login(email.trim(), password);
      const profile = await getUserProfile(session.user.id);

      if (!isPlatformAccount(profile)) {
        await logout();
        setError("This is not a platform account.");
        return;
      }
      navigate("/platform", { replace: true });
    } catch {
      setError("Incorrect credentials. Please check your email and password.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-800 p-4 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900">Platform Login</h1>
          <p className="text-gray-600 mt-2">For platform administrators only</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleLogin}
            disabled={email.length === 0 || password.length === 0}
            className="w-full bg-slate-800 text-white py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}
