import { useNavigate } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import arkaLogo from "./assets/arka_logo.png";

export default function AppSelector() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div
            className="inline-block mx-auto mb-4 rounded-2xl overflow-hidden bg-white shadow-lg p-3"
            style={{ animation: 'fadeInScale 0.6s ease-out' }}
          >
            <img src={arkaLogo} alt="Arka Bricks" className="max-h-20 object-contain" />
          </div>
          <h1 className="text-gray-900 mb-2">Arka Bricks</h1>
          <p className="text-gray-600">Select your application</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Employee App */}
          <button
            onClick={() => navigate("/employee")}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center group"
          >
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl inline-block mb-6 group-hover:scale-110 transition-transform shadow-lg">
              <Users className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-gray-900 mb-3">Employee App</h2>
            <p className="text-gray-600 mb-6">
              Material procurement, delivery entry, and production tracking
            </p>
            <div className="space-y-2 text-sm text-gray-600 text-left">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <span>Material Purchase Entry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <span>Production Entry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                <span>Delivery Entry</span>
              </div>
            </div>
          </button>

          {/* Admin App */}
          <button
            onClick={() => navigate("/admin")}
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-2 text-center group"
          >
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl inline-block mb-6 group-hover:scale-110 transition-transform shadow-lg">
              <Shield className="w-16 h-16 text-white" />
            </div>
            <h2 className="text-gray-900 mb-3">Admin App</h2>
            <p className="text-gray-600 mb-6">
              Complete business management and analytics dashboard
            </p>
            <div className="space-y-2 text-sm text-gray-600 text-left">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                <span>Order & Customer Management</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                <span>Inventory & Production Stats</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></div>
                <span>Accounts & Employee Management</span>
              </div>
            </div>
          </button>
        </div>
      </div>
      <p className="text-center text-gray-400 text-sm py-6">Powered by <span className="font-bold text-gray-500">GG-Tech</span></p>
    </div>
  );
}
