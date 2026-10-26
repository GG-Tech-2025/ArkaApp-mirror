import React from "react";
import { Building2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../services/middleware.service";

/** The platform's header bar and page width, shared by its main screens. */
export function PlatformLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/platform/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/platform")} className="flex items-center gap-3 hover:opacity-90">
            <Building2 className="w-6 h-6" />
            <span className="text-lg">Platform</span>
          </button>
          <button onClick={signOut} className="flex items-center gap-2 text-slate-200 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
