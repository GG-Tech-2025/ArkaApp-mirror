import { Routes, Route, Navigate } from "react-router-dom";
import { SettingsManagementScreen } from "./pages/SettingsManagementScreen";

export function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<SettingsManagementScreen />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
