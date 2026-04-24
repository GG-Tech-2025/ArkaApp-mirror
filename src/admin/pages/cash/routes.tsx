import { Routes, Route, Navigate } from "react-router-dom";
import { CashFlowScreen } from "./pages/CashFlowScreen";
import { CashLedgerScreen } from "./pages/CashLedgerScreen";
import { WithdrawMoneyScreen } from "./pages/WithdrawMoneyScreen";

export function CashRoutes() {
  return (
    <Routes>
      <Route index element={<CashFlowScreen />} />
      <Route path="ledger/:date" element={<CashLedgerScreen />} />
      <Route path="withdraw" element={<WithdrawMoneyScreen />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
