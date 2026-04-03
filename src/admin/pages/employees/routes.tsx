// pages/employees/EmployeesRoutes.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { CreateEmployeeScreen } from "./pages/CreateEmployeeScreen";
import { EmployeeManagementScreen } from "./pages/EmployeeManagementScreen";
import { EditEmployeeScreen } from "./pages/EditEmployeeScreen";
import { RoleSalarySetupScreen } from "./pages/RoleSalarySetupScreen";
import { CreateRoleScreen } from "./pages/CreateRoleScreen";
import { EditRoleScreen } from "./pages/EditRoleScreen";
import { AttendanceScreen } from "./pages/AttendanceScreen";
import { SalaryLedgerScreen } from "./pages/SalaryLedgerScreen";
import { SalaryLedgerDetailScreen } from "./pages/SalaryLedgerDetailScreen";
import { AddPaymentScreen } from "./pages/AddPaymentScreen";
import { CalculateSalaryScreen } from "./pages/CalculateSalaryScreen";

export function EmployeesRoutes() {
  return (
    <Routes>
      <Route index element={<EmployeeManagementScreen />} />
      <Route path="create" element={<CreateEmployeeScreen />} />
      <Route path=":id/edit" element={<EditEmployeeScreen />} />
      <Route path="role-setup" element={<RoleSalarySetupScreen />} />
      <Route path="role-setup/create" element={<CreateRoleScreen />} />
      <Route path="role-setup/:id/edit" element={<EditRoleScreen />} />
      <Route path="attendance" element={<AttendanceScreen />} />
      <Route path="salary-ledger" element={<SalaryLedgerScreen />} />
      <Route path="salary-ledger/calculate" element={<CalculateSalaryScreen />} />
      <Route path="salary-ledger/:id" element={<SalaryLedgerDetailScreen />} />
      <Route path="salary-ledger/:id/add-payment" element={<AddPaymentScreen />} />

      <Route path="*" element={<Navigate to="/admin/employees" replace />} />
    </Routes>
  );
}
