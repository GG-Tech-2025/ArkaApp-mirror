import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLoginScreen } from "./pages/AdminLoginScreen";
import { AdminHomeScreen } from "./pages/AdminHomeScreen";
import { ProductionStatisticsScreen } from "./pages/ProductionStatisticsScreen";
import { MetricsScreen } from "./pages/MetricsScreen";
import { CashRoutes } from "./pages/cash/routes";
import { LoansRoutes } from "./pages/loans/routes";
import { OrdersRoutes } from "./pages/orders/routes";
import { CustomersRoutes } from "./pages/customers/routes";
import { InventoryRoutes } from "./pages/Inventory/routes";
import { AccountsRoutes } from "./pages/accounts/routes";
import { VendorsRoutes } from "./pages/vendors/routes";
import { EmployeesRoutes } from "./pages/employees/routes";

export function AdminRoutes() {
  return (
     <Routes>
      {/* Default admin entry → login */}
      <Route path="/" element={<Navigate to="login" replace />} />

      {/* Login */}
      <Route path="login" element={<AdminLoginScreen />} />

      {/* Home */}
      <Route path="home" element={<AdminHomeScreen />} />

      {/* Other Admin Routes */}
      <Route path="orders/*" element={<OrdersRoutes />} />
      <Route path="production" element={<ProductionStatisticsScreen />} />
      <Route path="inventory/*" element={<InventoryRoutes />} />
      <Route path="customers/*" element={<CustomersRoutes />} />
      <Route path="accounts/*" element={<AccountsRoutes />} />
      <Route path="metrics" element={<MetricsScreen />} />
      <Route path="employees/*" element={<EmployeesRoutes />} />
      <Route path="salarys" element={<Navigate to="/admin/employees/salary-ledger" replace />} />
      <Route path="vendors/*" element={<VendorsRoutes />} />
      <Route path="cash/*" element={<CashRoutes />} />
      <Route path="loans/*" element={<LoansRoutes />} />

      {/* Safety fallback */}
      <Route path="*" element={<Navigate to="/admin/login" replace />} />
    </Routes>
  );
}