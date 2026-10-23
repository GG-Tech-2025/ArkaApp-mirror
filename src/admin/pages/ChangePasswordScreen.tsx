import React, { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  changeMyPassword,
  logout,
  mustChangePassword,
  validateSession,
} from "../../services/middleware.service";

const MIN_LENGTH = 8;

/** Turns the auth server's refusal into something a person can act on. */
function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string } | undefined;
  if (e?.code === "same_password") return "Choose a password different from your current one.";
  if (e?.code === "weak_password") return e.message || "That password is too weak. Try a longer one.";
  return "Could not change the password. Please try again.";
}

/**
 * Lets the signed-in user choose a new password. For a first-time admin still on
 * the temporary password it is required (the guard sends them here and there is
 * no way out except signing out); for everyone else it is optional.
 */
export function ChangePasswordScreen() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function check() {
      const user = await validateSession();
      if (!user) {
        navigate("/admin/login", { replace: true });
        return;
      }
      setRequired(mustChangePassword(user));
      setChecking(false);
    }
    check();
  }, []);

  const handleSubmit = async () => {
    if (saving) return;
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await changeMyPassword(password);
      navigate("/admin/home", { replace: true });
    } catch (e) {
      setError(describeError(e));
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-full mb-4">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900">{required ? "Choose a new password" : "Change password"}</h1>
          <p className="text-gray-600 mt-2 text-center">
            {required
              ? "You signed in with a temporary password. Choose your own to continue."
              : "Enter a new password for your account."}
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-gray-700 mb-2">New password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-sm text-gray-500 mt-1">At least {MIN_LENGTH} characters.</p>
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Confirm new password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={password.length === 0 || confirm.length === 0 || saving}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving..." : "Save password"}
          </button>

          {required ? (
            <button onClick={signOut} className="w-full text-gray-600 hover:text-gray-900">
              Sign out
            </button>
          ) : (
            <button onClick={() => navigate("/admin/home")} className="w-full text-gray-600 hover:text-gray-900">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
