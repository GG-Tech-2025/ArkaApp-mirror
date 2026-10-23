import { Navigate, Route, Routes } from "react-router-dom";
import { PlatformGuard } from "./PlatformGuard";
import { PlatformLoginScreen } from "./PlatformLoginScreen";
import { PlatformHomeScreen } from "./PlatformHomeScreen";
import { CreateOrganizationScreen } from "./CreateOrganizationScreen";

/** The platform operator's tool. Not linked from anywhere; reached at /platform. */
export function PlatformRoutes() {
  return (
    <Routes>
      <Route path="login" element={<PlatformLoginScreen />} />

      <Route element={<PlatformGuard />}>
        <Route index element={<PlatformHomeScreen />} />
        <Route path="organizations/new" element={<CreateOrganizationScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/platform" replace />} />
    </Routes>
  );
}
