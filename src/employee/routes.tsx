import { Navigate, Route, Routes } from "react-router-dom";
import { LoginScreen } from "./pages/LoginScreen";
import { HomeScreen } from "./pages/HomeScreen";
import { OrdersScreen } from "./pages/OrdersScreen";
import { DeliveryEntry } from "./pages/DeliveryEntry";
import { ProductionEntry } from "./pages/ProductionEntry";
import { MaterialPurchaseEntry } from "./pages/MaterialPurchaseEntry";
import { EmployeeGuard } from "./components/EmployeeGuard";

export function EmployeeRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="login" replace />} />
      <Route path="login" element={<LoginScreen />} />

      {/* Protected routes — require valid EMPLOYEE session and active status */}
      <Route element={<EmployeeGuard />}>
        <Route path="home" element={<HomeScreen />} />
        <Route path="material-entry" element={<MaterialPurchaseEntry />} />
        <Route path="production-entry" element={<ProductionEntry />} />
        <Route path="orders" element={<OrdersScreen />} />
        <Route path="orders/:orderId/delivery" element={<DeliveryEntry />} />
      </Route>

      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}