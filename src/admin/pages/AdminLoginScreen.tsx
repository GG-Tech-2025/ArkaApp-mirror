import React, { useState, useEffect } from "react";
import { Shield, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  login,
  validateSession,
  getUserProfile,
  logout,
} from "../../services/middleware.service";

export function AdminLoginScreen() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  /* ------------------------------------------------------------------
     1. AUTO SESSION CHECK (same as Employee, role = ADMIN)
  -------------------------------------------------------------------*/
  useEffect(() => {
    async function checkSession() {
      const user = await validateSession();
      if (!user) return;

      try {
        const profile = await getUserProfile(user.id);

        if (profile.role === "ADMIN") {
          navigate("/admin/home", { replace: true });
        } else {
          await logout();
        }
      } catch {
        await logout();
      }
    }

    checkSession();
  }, []);

  /* ------------------------------------------------------------------
     3. LOGIN HANDLER (role = ADMIN)
  -------------------------------------------------------------------*/
  const handleLogin = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      const session = await login(email, password);

      const userId = session.user.id;
      const profile = await getUserProfile(userId);

      if (profile.role !== "ADMIN") {
        await logout();
        setError("You are not authorized to access the Admin App.");
        return;
      }

      navigate("/admin/home", { replace: true });
    } catch {
      setError("Incorrect credentials. Please check your email and password.");
    }
  };

  /* ------------------------------------------------------------------
     UI
  -------------------------------------------------------------------*/
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to App Selection
        </button>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-full mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-gray-900">Admin Login</h1>
            <p className="text-gray-600 mt-2">
              Enter your credentials to continue
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="Enter admin email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={email.length === 0 || password.length === 0}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
            >
              Login
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-gray-400 text-sm py-6">Powered by <span className="font-bold text-gray-500">GG-Tech</span></p>
    </div>
  );
}
