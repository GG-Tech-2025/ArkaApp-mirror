// pages/employees/EmployeesRoutes.tsx
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { CreateEmployeeScreen } from "./pages/CreateEmployeeScreen";
import { EmployeeManagementScreen } from "./pages/EmployeeManagementScreen";
import { EditEmployeeScreen } from "./pages/EditEmployeeScreen";
import { RoleSalarySetupScreen } from "./pages/RoleSalarySetupScreen";
import { CreateRoleScreen } from "./pages/CreateRoleScreen";
import { EditRoleScreen } from "./pages/EditRoleScreen";
import { AttendanceScreen } from "./pages/AttendanceScreen";
import { SalaryLedgerScreen } from "./pages/SalaryLedgerScreen";
import { SalaryLedgerDetailScreen } from "../../../components/admin/SalaryLedgerDetailScreen";

/**
 * Adapts the legacy onNavigate prop used by SalaryLedgerDetailScreen
 * to React Router's navigate function.
 */
function SalaryLedgerDetailWrapper() {
  const navigate = useNavigate();

  const handleNavigate = (screen: string) => {
    switch (screen) {
      case 'salary-ledger':
        navigate('/admin/employees/salary-ledger');
        break;
      case 'add-payment':
        navigate('/admin/employees/salary-ledger/add-payment');
        break;
      default:
        navigate('/admin/employees/salary-ledger');
    }
  };

  return <SalaryLedgerDetailScreen onNavigate={handleNavigate as any} />;
}

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
      <Route path="salary-ledger/:id" element={<SalaryLedgerDetailWrapper />} />

      <Route path="*" element={<Navigate to="/admin/employees" replace />} />
    </Routes>
  );
}
